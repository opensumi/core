import { Emitter } from '@opensumi/ide-core-common';
import {
  ExtensionRunTestsRequest,
  IRichLocation,
  ISerializedTestResults,
  ITestItem,
  ITestOutputMessage,
  ITestRunTask,
  ResolvedTestRunRequest,
  TestResultItem,
  TestResultState,
} from './testCollection';

export type TestStateCount = { [K in TestResultState]: number };

export interface ITestRunTaskResults extends ITestRunTask {
  readonly coverage: any | undefined;

  readonly otherMessages: ITestOutputMessage[];
}

export const TestResultServiceToken = Symbol('TestResultService');

interface TestResultItemWithChildren extends TestResultItem {
  children: TestResultItemWithChildren[];
}

export const enum TestResultItemChangeReason {
  Retired,
  ParentRetired,
  ComputedStateChange,
  OwnStateChange,
}

export type TestResultItemChange = { item: TestResultItem; result: ITestResult } & (
  | {
      reason:
        | TestResultItemChangeReason.Retired
        | TestResultItemChangeReason.ParentRetired
        | TestResultItemChangeReason.ComputedStateChange;
    }
  | { reason: TestResultItemChangeReason.OwnStateChange; previous: TestResultState }
);

export interface ITestResultService {
  createTestResult(req: ResolvedTestRunRequest | ExtensionRunTestsRequest): ITestResult;
  addTestResult(result: ITestResult): void;
  getResult(resultId: string): ITestResult | undefined;
  readonly results: ReadonlyArray<ITestResult>;
}

export interface ITestResult {
  readonly id: string;

  readonly completedAt: number | undefined;

  readonly request: ResolvedTestRunRequest;

  readonly name: string;

  tests: IterableIterator<TestResultItem>;

  tasks: ReadonlyArray<ITestRunTaskResults>;

  getStateById(testExtId: string): TestResultItem | undefined;

  getOutput(): Promise<string>;

  toJSON(): ISerializedTestResults | undefined;

  updateState(testId: string, taskId: string, state: TestResultState, duration?: number): void;

  appendOutput(output: string, taskId: string, location?: IRichLocation, testId?: string): void;

  addTestChainToRun(controllerId: string, chain: ReadonlyArray<ITestItem>): void;

  addTask(task: ITestRunTask): void;

  markTaskComplete(taskId: string): void;

  markComplete(): void;
}

export class TestResultImpl implements ITestResult {
  private readonly completeEmitter = new Emitter<void>();
  private readonly changeEmitter = new Emitter<TestResultItemChange>();
  private readonly testById = new Map<string, TestResultItemWithChildren>();

  private _completedAt?: number;

  public readonly name: string;
  public readonly tasks: ITestRunTaskResults[] = [];
  public readonly onChange = this.changeEmitter.event;
  public readonly onComplete = this.completeEmitter.event;

  public get completedAt() {
    return this._completedAt;
  }

  public get tests() {
    return this.testById.values();
  }

  constructor(public readonly id: string, public readonly request: ResolvedTestRunRequest) {}

  getStateById(testExtId: string): TestResultItem | undefined {
    throw new Error('Method not implemented.');
  }
  getOutput(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  toJSON(): ISerializedTestResults | undefined {
    throw new Error('Method not implemented.');
  }
  updateState(testId: string, taskId: string, state: TestResultState, duration?: number): void {
    throw new Error('Method not implemented.');
  }
  appendOutput(output: string, taskId: string, location?: IRichLocation, testId?: string): void {
    throw new Error('Method not implemented.');
  }
  addTestChainToRun(controllerId: string, chain: readonly ITestItem[]): void {
    throw new Error('Method not implemented.');
  }
  addTask(task: ITestRunTask): void {
    throw new Error('Method not implemented.');
  }
  markTaskComplete(taskId: string): void {
    throw new Error('Method not implemented.');
  }
  markComplete(): void {
    throw new Error('Method not implemented.');
  }
}
