import { Event, IDisposable, CancellationToken } from '@opensumi/ide-core-browser';
import { ITestResult } from './test-result';
import {
  InternalTestItem,
  MainThreadTestCollection,
  ResolvedTestRunRequest,
  RunTestForControllerRequest,
  TestRunProfileBitset,
  TestsDiff,
} from './testCollection';

export * from './testId';

export interface ITestController {
  readonly id: string;
  readonly label: string;

  configureRunProfile(profileId: number): void;
  expandTest(testId: string, levels: number): Promise<void>;
  runTests(request: RunTestForControllerRequest, token: CancellationToken): Promise<void>;
}

export const TestServiceToken = Symbol('TestService');

export interface ITestService {
  readonly collection: MainThreadTestCollection;

  registerTestController(id: string, testController: ITestController): IDisposable;
  runTests(req: any, token?: CancellationToken): Promise<any>;
  publishDiff(controllerId: string, diff: TestsDiff): void;
  runResolvedTests(req: ResolvedTestRunRequest, token?: CancellationToken): Promise<ITestResult>;

  onDidProcessDiff: Event<TestsDiff>;
}

export interface AmbiguousRunTestsRequest {
  /** Group to run */
  group: TestRunProfileBitset;
  /** Tests to run. Allowed to be from different controllers */
  tests: readonly InternalTestItem[];
  /** Tests to exclude. If not given, the current UI excluded tests are used */
  exclude?: InternalTestItem[];
  /** Whether this was triggered from an auto run. */
  isAutoRun?: boolean;
}
