// eslint-disable no-console
import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { Logger } from '@opensumi/ide-core-browser';
import { CancellationToken, Disposable, DisposableStore, IDisposable, URI } from '@opensumi/ide-core-common';
import { ITestController, ITestService, TestServiceToken } from '@opensumi/ide-testing';
import { ObservableValue } from '@opensumi/ide-testing/lib/common/observableValue';
import { ITestProfileService, TestProfileServiceToken } from '@opensumi/ide-testing/lib/common/test-profile';
import {
  ITestResult,
  ITestResultService,
  TestResultImpl,
  TestResultServiceToken,
} from '@opensumi/ide-testing/lib/common/test-result';
import {
  ExtensionRunTestsRequest,
  ILocationDto,
  ITestItem,
  ITestRunProfile,
  ITestRunTask,
  ResolvedTestRunRequest,
  SerializedTestMessage,
  TestDiffOpType,
  TestResultState,
  TestsDiff,
} from '@opensumi/ide-testing/lib/common/testCollection';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { ExtHostAPIIdentifier, IExtHostTests, IMainThreadTesting, ITestControllerPatch } from '../../../common/vscode';

const reviveDiff = (diff: TestsDiff) => {
  for (const entry of diff) {
    if (entry[0] === TestDiffOpType.Add || entry[0] === TestDiffOpType.Update) {
      const item = entry[1];
      if (item.item?.uri) {
        item.item.uri = URI.revive(item.item.uri);
      }
      if (item.item?.range) {
        item.item.range = Range.lift(item.item.range);
      }
    }
  }
};

@Injectable({ multiple: true })
export class MainThreadTestsImpl extends Disposable implements IMainThreadTesting {
  @Autowired()
  private logger: Logger;

  private proxy: IExtHostTests;

  private readonly testProviderRegistrations = new Map<
    string,
    {
      instance: ITestController;
      label: string;
      canRefresh: ObservableValue<boolean>;
      disposable: IDisposable;
    }
  >();

  @Autowired(TestServiceToken)
  protected readonly testService: ITestService;

  @Autowired(TestProfileServiceToken)
  protected readonly testProfiles: ITestProfileService;

  @Autowired(TestResultServiceToken)
  protected readonly resultService: ITestResultService;

  constructor(@Optional(Symbol()) rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostTests);
  }

  $registerTestController(controllerId: string, label: string, canRefreshValue: boolean): void {
    const disposable = new DisposableStore();
    const canRefresh = disposable.add(new ObservableValue(canRefreshValue));

    const controller: ITestController = {
      id: controllerId,
      label,
      canRefresh,
      configureRunProfile: (id) => this.proxy.$configureRunProfile(controllerId, id),
      refreshTests: (token) => this.proxy.$refreshTests(controllerId, token),
      runTests: (req, token) => this.proxy.$runControllerTests(req, token),
      expandTest: (testId, levels) => this.proxy.$expandTest(testId, isFinite(levels) ? levels : -1),
    };

    disposable.add(Disposable.create(() => this.testProfiles.removeProfile(controllerId)));
    disposable.add(this.testService.registerTestController(controllerId, controller));

    this.testProviderRegistrations.set(controllerId, {
      instance: controller,
      label,
      canRefresh,
      disposable,
    });
  }

  $updateController(controllerId: string, patch: ITestControllerPatch): void {
    const controller = this.testProviderRegistrations.get(controllerId);
    if (!controller) {
      return;
    }

    if (patch.label !== undefined) {
      controller.label = patch.label;
    }

    if (patch.canRefresh !== undefined) {
      controller.canRefresh.value = patch.canRefresh;
    }
  }

  $unregisterTestController(controllerId: string): void {
    this.logger.warn('test: unregisterTestController>>', controllerId);
  }

  $subscribeToDiffs(): void {
    this.logger.warn('test: subscribeToDiffs>>');
  }

  $unsubscribeFromDiffs(): void {
    this.logger.warn('test: unsubscribeFromDiffs>>');
  }

  $publishDiff(controllerId: string, diff: TestsDiff): void {
    reviveDiff(diff);
    this.testService.publishDiff(controllerId, diff);
  }

  $publishTestRunProfile(config: ITestRunProfile): void {
    const controller = this.testProviderRegistrations.get(config.controllerId);
    if (controller) {
      this.testProfiles.addProfile(controller.instance, config);
    }
  }

  $updateTestRunConfig(controllerId: string, configId: number, update: Partial<ITestRunProfile>): void {
    this.logger.warn('Method not implemented.');
  }
  $removeTestProfile(controllerId: string, configId: number): void {
    this.testProfiles.removeProfile(controllerId, configId);
  }
  async $runTests(req: ResolvedTestRunRequest, token: CancellationToken): Promise<string> {
    const result = await this.testService.runResolvedTests(req, token);
    return result.id;
  }

  $addTestsToRun(controllerId: string, runId: string, tests: ITestItem[]): void {
    for (const test of tests) {
      test.uri = URI.revive(test.uri);
      if (test.range) {
        test.range = Range.lift(test.range);
      }
    }
    this.withTestResult(runId, (r) => r.addTestChainToRun(controllerId, tests));
  }

  $updateTestStateInRun(
    runId: string,
    taskId: string,
    testId: string,
    state: TestResultState,
    duration?: number,
  ): void {
    this.withTestResult(runId, (r) => r.updateState(testId, taskId, state, duration));
  }

  $appendTestMessagesInRun(runId: string, taskId: string, testId: string, messages: SerializedTestMessage[]): void {
    const r = this.resultService.getResult(runId);
    if (r && r instanceof TestResultImpl) {
      for (const message of messages) {
        if (message.location) {
          message.location.uri = URI.revive(message.location.uri);
          message.location.range = Range.lift(message.location.range);
        }

        r.appendMessage(testId, taskId, message);
      }
    }
  }

  $appendOutputToRun(runId: string, taskId: string, output: string, locationDto?: ILocationDto, testId?: string): void {
    const location = locationDto && {
      uri: URI.revive(locationDto.uri),
      range: Range.lift(locationDto.range),
    };
    this.withTestResult(runId, (r) => r.appendOutput(output, taskId, location, testId));
  }

  $signalCoverageAvailable(runId: string, taskId: string): void {
    this.logger.warn('$signalCoverageAvailable', runId, taskId);
  }

  $startedTestRunTask(runId: string, task: ITestRunTask): void {
    this.withTestResult(runId, (r) => r.addTask(task));
  }

  $finishedTestRunTask(runId: string, taskId: string): void {
    this.withTestResult(runId, (r) => r.markTaskComplete(taskId));
  }

  $startedExtensionTestRun(req: ExtensionRunTestsRequest): void {
    this.resultService.createTestResult(req);
  }

  $finishedExtensionTestRun(runId: string): void {
    this.withTestResult(runId, (r) => r.markComplete());
  }

  $markTestRetired(testIds: string[] | undefined): void {
    this.logger.warn('Method not implemented.');
  }

  private withTestResult<T>(runId: string, fn: (run: ITestResult) => T): T | undefined {
    const r = this.resultService.getResult(runId);
    return r && r instanceof TestResultImpl ? fn(r) : undefined;
  }
}
