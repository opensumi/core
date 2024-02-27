import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  Emitter,
  IDisposable,
  SlotLocation,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser/lib/context-key';
import { TestingCanRefreshTests, TestingServiceProviderCount } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AmbiguousRunTestsRequest, ITestController, ITestService, TestId } from '../common';
import { Testing } from '../common/constants';
import { ITestProfileService, TestProfileServiceToken, canUseProfileWithTest } from '../common/test-profile';
import { ITestResult, ITestResultService, TestResultServiceToken } from '../common/test-result';
import { MainThreadTestCollection, ResolvedTestRunRequest, TestDiffOpType, TestsDiff } from '../common/testCollection';
import { TestingContainerId } from '../common/testing-view';

import { TestingView } from './components/testing.view';

@Injectable()
export class TestServiceImpl extends Disposable implements ITestService {
  private controllers = new Map<string, ITestController>();
  private controllerCount: IContextKey<number>;
  private canRefreshTests: IContextKey<boolean>;

  private readonly processDiffEmitter = new Emitter<TestsDiff>();
  private viewId = '';

  readonly collection = new MainThreadTestCollection(this.expandTest.bind(this));
  readonly onDidProcessDiff = this.processDiffEmitter.event;

  @Autowired(IMainLayoutService)
  protected readonly mainlayoutService: IMainLayoutService;

  @Autowired(TestResultServiceToken)
  protected readonly resultService: ITestResultService;

  @Autowired(TestProfileServiceToken)
  protected readonly testProfiles: ITestProfileService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  constructor() {
    super();
    this.controllerCount = TestingServiceProviderCount.bind(this.contextKeyService);
    this.canRefreshTests = TestingCanRefreshTests.bind(this.contextKeyService);
  }

  public getTestController(controllerId: string): ITestController | undefined {
    return this.controllers.get(controllerId);
  }

  public async refreshTests(controllerId?: string): Promise<void> {
    const cts = new CancellationTokenSource();
    try {
      if (controllerId) {
        await this.controllers.get(controllerId)?.refreshTests(cts.token);
      } else {
        await Promise.all([...this.controllers.values()].map((c) => c.refreshTests(cts.token)));
      }
    } finally {
      cts.dispose(true);
    }
  }

  private registerTestingExplorerView(): string {
    this.mainlayoutService.collectViewComponent;
    return this.mainlayoutService.collectTabbarComponent(
      [{ id: TestingContainerId }],
      {
        iconClass: getIcon('test'),
        title: localize('test.title'),
        priority: 1,
        containerId: Testing.ExplorerViewId,
        component: TestingView,
        activateKeyBinding: 'ctrlcmd+shift+t',
      },
      SlotLocation.left,
    );
  }

  registerTestController(id: string, testController: ITestController): IDisposable {
    this.controllers.set(id, testController);
    this.controllerCount.set(this.controllers.size);
    this.updateCanRefresh();

    if (this.controllers.size > 0 && !this.viewId) {
      this.viewId = this.registerTestingExplorerView();
    }

    const disposable = new Disposable();

    disposable.addDispose(
      Disposable.create(() => {
        const diff: TestsDiff = [];
        for (const root of this.collection.rootItems) {
          if (root.controllerId === id) {
            diff.push([TestDiffOpType.Remove, root.item.extId]);
          }
        }
        this.publishDiff(id, diff);

        if (this.controllers.delete(id)) {
          this.controllerCount.set(this.controllers.size);
          this.updateCanRefresh();
          if (this.controllers.size === 0 && this.viewId) {
            this.mainlayoutService.disposeContainer(this.viewId);
          }
        }
      }),
    );

    disposable.addDispose(testController.canRefresh.onDidChange(this.updateCanRefresh, this));

    return disposable;
  }

  private updateCanRefresh() {
    this.canRefreshTests.set(Array.from(this.controllers.values()).some((c) => c.canRefresh));
  }

  public async expandTest(id: string, levels: number) {
    await this.controllers.get(TestId.fromString(id).controllerId)?.expandTest(id, levels);
  }

  publishDiff(_controllerId: string, diff: TestsDiff) {
    this.collection.apply(diff);
    this.processDiffEmitter.fire(diff);
  }

  runTests(req: AmbiguousRunTestsRequest, token = CancellationToken.None): Promise<ITestResult> {
    const resolved: ResolvedTestRunRequest = {
      targets: [],
      exclude: req.exclude?.map((t) => t.item.extId),
      isAutoRun: req.isAutoRun,
    };
    const profiles = this.testProfiles.getBaseDefaultsProfile(req.group);
    for (const profile of profiles) {
      const testIds = req.tests.filter((t) => canUseProfileWithTest(profile, t)).map((t) => t.item.extId);
      resolved.targets.push({
        testIds,
        profileGroup: profile.group,
        profileId: profile.profileId,
        controllerId: profile.controllerId,
      });
    }

    return this.runResolvedTests(resolved, token);
  }

  async runResolvedTests(req: ResolvedTestRunRequest, token?: CancellationToken): Promise<ITestResult> {
    if (!req.exclude) {
      // default exclude
      req.exclude = [];
    }

    const result = this.resultService.createTestResult(req);
    try {
      const cancelSource = new CancellationTokenSource(token);
      const requests = req.targets.map((group) =>
        this.controllers
          .get(group.controllerId)
          ?.runTests(
            {
              runId: result.id,
              excludeExtIds: req.exclude!.filter((t) => !group.testIds.includes(t)),
              profileId: group.profileId,
              controllerId: group.controllerId,
              testIds: group.testIds,
            },
            cancelSource.token,
          )
          .catch(() => {
            //
          }),
      );
      await Promise.all(requests);
      return result;
    } finally {
      result.markComplete();
    }
  }
}
