import { Emitter, formatLocalize, localize } from '@opensumi/ide-core-common';

import { IComputedStateAccessor, refreshComputedState } from './getComputedState';
import {
  ExtensionRunTestsRequest,
  IRichLocation,
  ISerializedTestResults,
  ITestItem,
  ITestMessage,
  ITestOutputMessage,
  ITestRunTask,
  ITestTaskState,
  ResolvedTestRunRequest,
  SerializedTestMessage,
  TestItemExpandState,
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

export const enum TestResultItemChangeReason {
  Retired,
  ParentRetired,
  ComputedStateChange,
  OwnStateChange,
}

interface TestResultItemWithChildren extends TestResultItem {
  children: TestResultItemWithChildren[];
}

const itemToNode = (controllerId: string, item: ITestItem, parent: string | null): TestResultItemWithChildren => ({
  parent,
  controllerId,
  expand: TestItemExpandState.NotExpandable,
  item: { ...item },
  children: [],
  tasks: [],
  ownComputedState: TestResultState.Unset,
  computedState: TestResultState.Unset,
  retired: false,
});

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

export const maxCountPriority = (counts: Readonly<TestStateCount>) => {
  for (const state of statesInOrder) {
    if (counts[state] > 0) {
      return state;
    }
  }

  return TestResultState.Unset;
};

export const resultItemParents = function* (results: ITestResult, item: TestResultItem) {
  let i: TestResultItem | undefined = item;
  while (i) {
    yield i;
    i = i.parent ? results.getStateById(i.parent) : undefined;
  }
};

export interface ITestResult {
  readonly counts: Readonly<TestStateCount>;

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

  public readonly name: string = formatLocalize('test.result.runFinished', new Date().toLocaleString());
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

  constructor(public readonly id: string, public readonly request: ResolvedTestRunRequest) {}

  protected setAllToState(
    state: TestResultState,
    taskId: string,
    when: (task: ITestTaskState, item: TestResultItem) => boolean,
  ) {
    const index = this.mustGetTaskIndex(taskId);
    for (const test of this.testById.values()) {
      if (when(test.tasks[index], test)) {
        this.fireUpdateAndRefresh(test, index, state);
      }
    }
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

  private addTestToRun(controllerId: string, item: ITestItem, parent: string | null) {
    const node = itemToNode(controllerId, item, parent);
    this.testById.set(item.extId, node);
    this.counts[TestResultState.Unset]++;

    if (parent) {
      this.testById.get(parent)?.children.push(node);
    }

    if (this.tasks.length) {
      this.tasks.forEach(() => {
        node.tasks.push({ duration: undefined, messages: [], state: TestResultState.Queued });
      });
    }

    return node;
  }

  private mustGetTaskIndex(taskId: string) {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) {
      throw new Error(`Unknown task ${taskId} in updateState`);
    }

    return index;
  }

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
    return this.testById.get(testExtId);
  }

  getOutput(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  toJSON(): ISerializedTestResults | undefined {
    throw new Error('Method not implemented.');
  }
  updateState(testId: string, taskId: string, state: TestResultState, duration?: number): void {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }

    const index = this.mustGetTaskIndex(taskId);
    if (duration !== undefined) {
      entry.tasks[index].duration = duration;
      entry.ownDuration = Math.max(entry.ownDuration || 0, duration);
    }

    this.fireUpdateAndRefresh(entry, index, state);
  }
  appendMessage(testId: string, taskId: string, message: ITestMessage | SerializedTestMessage) {
    const entry = this.testById.get(testId);
    if (!entry) {
      return;
    }

    entry.tasks[this.mustGetTaskIndex(taskId)].messages.push(message as ITestMessage);
    this.changeEmitter.fire({
      item: entry,
      result: this,
      reason: TestResultItemChangeReason.OwnStateChange,
      previous: entry.ownComputedState,
    });
  }
  appendOutput(output: string, taskId: string, location?: IRichLocation, testId?: string): void {
    throw new Error('Method not implemented.');
  }
  addTestChainToRun(controllerId: string, chain: readonly ITestItem[]): void {
    let parent = this.testById.get(chain[0].extId);
    if (!parent) {
      parent = this.addTestToRun(controllerId, chain[0], null);
    }

    for (let i = 1; i < chain.length; i++) {
      parent = this.addTestToRun(controllerId, chain[i], parent.item.extId);
    }

    for (let i = 0; i < this.tasks.length; i++) {
      this.fireUpdateAndRefresh(parent, i, TestResultState.Queued);
    }

    return undefined;
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
    this.tasks[this.mustGetTaskIndex(taskId)].running = false;
    this.setAllToState(
      TestResultState.Unset,
      taskId,
      (t) => t.state === TestResultState.Queued || t.state === TestResultState.Running,
    );
  }
  markComplete(): void {
    if (this._completedAt !== undefined) {
      throw new Error('cannot complete a test result multiple times');
    }

    for (const task of this.tasks) {
      if (task.running) {
        this.markTaskComplete(task.id);
      }
    }

    this._completedAt = Date.now();
    this.completeEmitter.fire();
  }
}
