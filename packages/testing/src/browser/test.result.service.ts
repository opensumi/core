import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, IContextKey, IContextKeyService, URI, uuid } from '@opensumi/ide-core-browser';
import { TestingHasAnyResults, TestingIsRunning } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import { findFirstInSorted } from '@opensumi/ide-core-common/lib/arrays';

import { ITestProfileService, TestProfileServiceToken } from '../common/test-profile';
import {
  ITestResult,
  ITestResultService,
  TestResultImpl,
  TestResultItemChange,
  TestResultItemChangeReason,
} from '../common/test-result';
import {
  ResolvedTestRunRequest,
  ExtensionRunTestsRequest,
  ITestRunProfile,
  TestResultItem,
  TestResultState,
} from '../common/testCollection';
import { parseTestUri } from '../common/testingUri';

import { TestDto } from './outputPeek/test-output-peek';

export type ResultChangeEvent =
  | { completed: ITestResult }
  | { started: ITestResult }
  | { inserted: ITestResult }
  | { removed: ITestResult[] };

export const isRunningTests = (service: ITestResultService) =>
  service.results.length > 0 && service.results[0].completedAt === undefined;

@Injectable()
export class TestResultServiceImpl implements ITestResultService {
  @Autowired(TestProfileServiceToken)
  protected readonly testProfiles: ITestProfileService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  private changeResultEmitter = new Emitter<ResultChangeEvent>();
  private testChangeEmitter = new Emitter<TestResultItemChange>();

  private _results: ITestResult[] = [];
  private readonly hasAnyResults: IContextKey<boolean>;
  private readonly isRunning: IContextKey<boolean>;

  public get results(): ITestResult[] {
    return this._results;
  }

  public readonly onResultsChanged = this.changeResultEmitter.event;
  public readonly onTestChanged = this.testChangeEmitter.event;

  constructor() {
    this.hasAnyResults = TestingHasAnyResults.bind(this.contextKeyService);
    this.isRunning = TestingIsRunning.bind(this.contextKeyService);
  }

  private onComplete(result: ITestResult) {
    this.resort();
    this.updateIsRunning();
    this.changeResultEmitter.fire({ completed: result });
  }

  private resort() {
    this.results.sort(
      (a, b) => (b.completedAt ?? Number.MAX_SAFE_INTEGER) - (a.completedAt ?? Number.MAX_SAFE_INTEGER),
    );
  }

  private updateIsRunning() {
    this.isRunning.set(isRunningTests(this));
  }

  public retrieveTest(uri: URI): TestDto | undefined {
    const parts = parseTestUri(uri);
    if (!parts) {
      return undefined;
    }

    const { resultId, testExtId, taskIndex, messageIndex } = parts;
    const test = this.getResult(parts.resultId)?.getStateById(testExtId);
    if (!test || !test.tasks[parts.taskIndex]) {
      return;
    }

    return new TestDto(resultId, test, taskIndex, messageIndex);
  }

  public createTestResult(req: ResolvedTestRunRequest | ExtensionRunTestsRequest): ITestResult {
    if ('targets' in req) {
      const id = uuid();
      const testResult = new TestResultImpl(id, req);
      this.addTestResult(testResult);
      return testResult;
    }

    let profile: ITestRunProfile | undefined;
    if ((req as ExtensionRunTestsRequest).profile) {
      const profiles = this.testProfiles.getControllerProfiles((req as ExtensionRunTestsRequest).controllerId);
      profile = profiles.find((c) => c.profileId === (req as ExtensionRunTestsRequest).profile!.id);
    }

    const resolved: ResolvedTestRunRequest = {
      targets: [],
      exclude: (req as ExtensionRunTestsRequest).exclude,
      isAutoRun: false,
    };

    if (profile) {
      resolved.targets.push({
        profileGroup: profile.group,
        profileId: profile.profileId,
        controllerId: (req as ExtensionRunTestsRequest).controllerId,
        testIds: (req as ExtensionRunTestsRequest).include,
      });
    }

    const result = new TestResultImpl((req as ExtensionRunTestsRequest).id, resolved);
    this.addTestResult(result);
    return result;
  }

  public getResult(resultId: string): ITestResult | undefined {
    return this.results.find((r) => r.id === resultId);
  }

  public addTestResult(result: ITestResult): ITestResult {
    if (result.completedAt === undefined) {
      this.results.unshift(result);
    } else {
      const index = findFirstInSorted(
        this.results,
        (r) => r.completedAt !== undefined && r.completedAt <= result.completedAt!,
      );
      this.results.splice(index, 0, result);
    }

    this.hasAnyResults.set(true);

    if (result instanceof TestResultImpl) {
      result.onComplete(() => this.onComplete(result));
      result.onChange(this.testChangeEmitter.fire, this.testChangeEmitter);
      this.isRunning.set(true);
      this.changeResultEmitter.fire({ started: result });
    } else {
      this.changeResultEmitter.fire({ inserted: result });
      for (const item of result.tests) {
        for (const otherResult of this.results) {
          if (otherResult === result) {
            this.testChangeEmitter.fire({ item, result, reason: TestResultItemChangeReason.ComputedStateChange });
            break;
          } else if (otherResult.getStateById(item.item.extId) !== undefined) {
            break;
          }
        }
      }
    }

    return result;
  }

  public getStateById(extId: string): [results: ITestResult, item: TestResultItem] | undefined {
    for (const result of this.results) {
      const lookup = result.getStateById(extId);
      if (lookup && lookup.computedState !== TestResultState.Unset) {
        return [result, lookup];
      }
    }
    return undefined;
  }

  public clear() {
    const keep: ITestResult[] = [];
    const removed: ITestResult[] = [];
    for (const result of this.results) {
      if (result.completedAt !== undefined) {
        removed.push(result);
      } else {
        keep.push(result);
      }
    }

    this._results = keep;
    if (keep.length === 0) {
      this.hasAnyResults.set(false);
    }
    this.changeResultEmitter.fire({ removed });
  }
}
