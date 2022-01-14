import { Emitter } from '@opensumi/ide-core-common';
import { IComputedStateAccessor, refreshComputedState } from './getComputedState';
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
import { maxPriority, statesInOrder } from './testingStates';

export type TestStateCount = { [K in TestResultState]: number };

export const makeEmptyCounts = () => {
  const o: Partial<TestStateCount> = {};
  for (const state of statesInOrder) {
    o[state] = 0;
  }

  return o as TestStateCount;
};
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
  public readonly counts: { [K in TestResultState]: number } = makeEmptyCounts();

  public get completedAt() {
    return this._completedAt;
  }

  public get tests() {
    return this.testById.values();
  }

  private readonly computedStateAccessor: IComputedStateAccessor<TestResultItemWithChildren> = {
    getOwnState: (i) => i.ownComputedState,
    getCurrentComputedState: (i) => i.computedState,
    setComputedState: (i, s) => (i.computedState = s),
    getChildren: (i) => i.children,
    getParents: (i) => {
      const { testById: testByExtId } = this;
      return (function* () {
        for (let parentId = i.parent; parentId; ) {
          const parent = testByExtId.get(parentId);
          if (!parent) {
            break;
          }

          yield parent;
          parentId = parent.parent;
        }
      })();
    },
  };

  constructor(public readonly id: string, public readonly request: ResolvedTestRunRequest) {}

  private fireUpdateAndRefresh(entry: TestResultItem, taskIndex: number, newState: TestResultState) {
    const previousOwnComputed = entry.ownComputedState;
    entry.tasks[taskIndex].state = newState;
    const newOwnComputed = maxPriority(...entry.tasks.map((t) => t.state));
    if (newOwnComputed === previousOwnComputed) {
      return;
    }

    entry.ownComputedState = newOwnComputed;
    this.counts[previousOwnComputed]--;
    this.counts[newOwnComputed]++;
    refreshComputedState(this.computedStateAccessor, entry).forEach((t) =>
      this.changeEmitter.fire(
        t === entry
          ? {
              item: entry,
              result: this,
              reason: TestResultItemChangeReason.OwnStateChange,
              previous: previousOwnComputed,
            }
          : { item: t, result: this, reason: TestResultItemChangeReason.ComputedStateChange },
      ),
    );
  }

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
    const index = this.tasks.length;
    // ** coverage not implemented **
    this.tasks.push({ ...task, coverage: undefined, otherMessages: [] });
    for (const test of this.tests) {
      test.tasks.push({ duration: undefined, messages: [], state: TestResultState.Unset });
      this.fireUpdateAndRefresh(test, index, TestResultState.Queued);
    }
  }
  markTaskComplete(taskId: string): void {
    throw new Error('Method not implemented.');
  }
  markComplete(): void {
    throw new Error('Method not implemented.');
  }
}
