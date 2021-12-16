import { Injectable, Autowired } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser/lib/context-key';
import { TestingServiceProviderCount } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  Emitter,
  IDisposable,
  localize,
} from '@opensumi/ide-core-common';

import { ITestController, ITestService, TestId } from '../common';
import { canUseProfileWithTest, ITestProfileService, TestProfileServiceToken } from '../common/test-profile';
import { ITestResultService, TestResultServiceToken } from '../common/test-result';
import { MainThreadTestCollection, ResolvedTestRunRequest, TestDiffOpType, TestsDiff } from '../common/testCollection';

@Injectable()
export class TestServiceImpl extends Disposable implements ITestService {
  private controllers = new Map<string, ITestController>();
  private controllerCount: IContextKey<number>;

  private readonly processDiffEmitter = new Emitter<TestsDiff>();

  readonly collection = new MainThreadTestCollection(this.expandTest.bind(this));
  readonly onDidProcessDiff = this.processDiffEmitter.event;

  @Autowired(TestResultServiceToken)
  protected readonly resultService: ITestResultService;

  @Autowired(TestProfileServiceToken)
  protected readonly testProfiles: ITestProfileService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  constructor() {
    super();
    this.controllerCount = TestingServiceProviderCount.bind(this.contextKeyService);
  }

  registerTestController(id: string, testController: ITestController): IDisposable {
    this.controllers.set(id, testController);
    this.controllerCount.set(this.controllers.size);

    return Disposable.create(() => {
      const diff: TestsDiff = [];
      for (const root of this.collection.rootItems) {
        if (root.controllerId === id) {
          diff.push([TestDiffOpType.Remove, root.item.extId]);
        }
      }
      this.publishDiff(id, diff);

      if (this.controllers.delete(id)) {
        this.controllerCount.set(this.controllers.size);
      }
    });
  }

  public async expandTest(id: string, levels: number) {
    await this.controllers.get(TestId.fromString(id).controllerId)?.expandTest(id, levels);
  }

  publishDiff(_controllerId: string, diff: TestsDiff) {
    this.collection.apply(diff);
    this.processDiffEmitter.fire(diff);
  }

  runTests(req: any, token = CancellationToken.None): Promise<any> {
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

  async runResolvedTests(req: ResolvedTestRunRequest, token?: CancellationToken): Promise<any> {
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
    } finally {
      result.markComplete();
    }
  }
}
