/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/tree/main/src/vs/workbench/contrib/testing/common

import { Uri as URI, IRange, IPosition, Emitter, map, IMarkdownString } from '@opensumi/ide-core-common';

export type TestsDiffOp =
  | [op: TestDiffOpType.Add, item: InternalTestItem]
  | [op: TestDiffOpType.Update, item: ITestItemUpdate]
  | [op: TestDiffOpType.Remove, itemId: string]
  | [op: TestDiffOpType.Retire, itemId: string]
  | [op: TestDiffOpType.IncrementPendingExtHosts, amount: number]
  | [op: TestDiffOpType.AddTag, tag: ITestTagDisplayInfo]
  | [op: TestDiffOpType.RemoveTag, id: string];

/**
 * Request from the ext host or main thread to indicate that tests have
 * changed. It's assumed that any item upserted *must* have its children
 * previously also upserted, or upserted as part of the same operation.
 * Children that no longer exist in an upserted item will be removed.
 */
export type TestsDiff = TestsDiffOp[];

/**
 * TestItem-like shape, butm with an ID and children as strings.
 */
export interface InternalTestItem {
  /** Controller ID from whence this test came */
  controllerId: string;
  /** Expandability state */
  expand: TestItemExpandState;
  /** Parent ID, if any */
  parent: string | null;
  /** Raw test item properties */
  item: ITestItem;
}

export const enum TestDiffOpType {
  /** Adds a new test (with children) */
  Add,
  /** Shallow-updates an existing test */
  Update,
  /** Removes a test (and all its children) */
  Remove,
  /** Changes the number of controllers who are yet to publish their collection roots. */
  IncrementPendingExtHosts,
  /** Retires a test/result */
  Retire,
  /** Add a new test tag */
  AddTag,
  /** Remove a test tag */
  RemoveTag,
}

export const enum TestResultState {
  Unset = 0,
  Queued = 1,
  Running = 2,
  Passed = 3,
  Failed = 4,
  Skipped = 5,
  Errored = 6,
}

export const enum TestRunProfileBitset {
  Run = 1 << 1,
  Debug = 1 << 2,
  Coverage = 1 << 3,
  HasNonDefaultProfile = 1 << 4,
  HasConfigurable = 1 << 5,
}

/**
 * List of all test run profile bitset values.
 */
export const testRunProfileBitsetList = [
  TestRunProfileBitset.Run,
  TestRunProfileBitset.Debug,
  TestRunProfileBitset.Coverage,
  TestRunProfileBitset.HasNonDefaultProfile,
];

/**
 * DTO for a controller's run profiles.
 */
export interface ITestRunProfile {
  controllerId: string;
  profileId: number;
  label: string;
  group: TestRunProfileBitset;
  isDefault: boolean;
  tag: string | null;
  hasConfigurationHandler: boolean;
}

/**
 * A fully-resolved request to run tests, passsed between the main thread
 * and extension host.
 */
export interface ResolvedTestRunRequest {
  targets: {
    testIds: string[];
    controllerId: string;
    profileGroup: TestRunProfileBitset;
    profileId: number;
  }[];
  exclude?: string[];
  isAutoRun?: boolean;
}

/**
 * Request to the main thread to run a set of tests.
 */
export interface ExtensionRunTestsRequest {
  id: string;
  include: string[];
  exclude: string[];
  controllerId: string;
  profile?: { group: TestRunProfileBitset; id: number };
  persist: boolean;
}

/**
 * Request from the main thread to run tests for a single controller.
 */
export interface RunTestForControllerRequest {
  runId: string;
  controllerId: string;
  profileId: number;
  excludeExtIds: string[];
  testIds: string[];
}

/**
 * Location with a fully-instantiated Range and URI.
 */
export interface IRichLocation {
  range: IRange;
  uri: URI;
}

export const enum TestMessageType {
  Error,
  Info,
}

export interface ILocationDto {
  uri: URI;
  range: IRange;
}

export interface ITestErrorMessage {
  message: string | IMarkdownString;
  type: TestMessageType.Error;
  expected: string | undefined;
  actual: string | undefined;
  location: IRichLocation | undefined;
}

export type SerializedTestErrorMessage = Omit<ITestErrorMessage, 'location'> & { location?: ILocationDto };

export interface ITestOutputMessage {
  message: string;
  type: TestMessageType.Info;
  offset: number;
  location: IRichLocation | undefined;
}

export type SerializedTestOutputMessage = Omit<ITestOutputMessage, 'location'> & { location?: ILocationDto };

export type SerializedTestMessage = SerializedTestErrorMessage | SerializedTestOutputMessage;

export type ITestMessage = ITestErrorMessage | ITestOutputMessage;

export interface ITestTaskState {
  state: TestResultState;
  duration: number | undefined;
  messages: ITestMessage[];
}

export interface ITestRunTask {
  id: string;
  name: string | undefined;
  running: boolean;
}

export interface ITestTag {
  id: string;
}

export interface ITestTagDisplayInfo {
  id: string;
  ctrlLabel: string;
}

/**
 * A partial update made to an existing InternalTestItem.
 */
export interface ITestItemUpdate {
  extId: string;
  expand?: TestItemExpandState;
  item?: Partial<ITestItem>;
}

/**
 * The TestItem from .d.ts, as a plain object without children.
 */
export interface ITestItem {
  /** ID of the test given by the test controller */
  extId: string;
  label: string;
  tags: string[];
  busy?: boolean;
  children?: never;
  uri?: URI;
  range: IRange | null;
  description: string | null;
  error: string | IMarkdownString | null;
}

export const enum TestItemExpandState {
  NotExpandable,
  Expandable,
  BusyExpanding,
  Expanded,
}

export const applyTestItemUpdate = (internal: InternalTestItem | ITestItemUpdate, patch: ITestItemUpdate) => {
  if (patch.expand !== undefined) {
    internal.expand = patch.expand;
  }
  if (patch.item !== undefined) {
    internal.item = internal.item ? Object.assign(internal.item, patch.item) : patch.item;
  }
};

/**
 * Test result item used in the main thread.
 */
export interface TestResultItem extends InternalTestItem {
  /** State of this test in various tasks */
  tasks: ITestTaskState[];
  /** State of this test as a computation of its tasks */
  ownComputedState: TestResultState;
  /** Computed state based on children */
  computedState: TestResultState;
  /** True if the test is outdated */
  retired: boolean;
  /** Max duration of the item's tasks (if run directly) */
  ownDuration?: number;
}

export type SerializedTestResultItem = Omit<TestResultItem, 'children' | 'expandable' | 'retired'> & {
  children: string[];
  retired: undefined;
};

/**
 * Test results serialized for transport and storage.
 */
export interface ISerializedTestResults {
  /** ID of these test results */
  id: string;
  /** Time the results were compelted */
  completedAt: number;
  /** Subset of test result items */
  items: SerializedTestResultItem[];
  /** Tasks involved in the run. */
  tasks: { id: string; name: string | undefined; messages: ITestOutputMessage[] }[];
  /** Human-readable name of the test run. */
  name: string;
  /** Test trigger informaton */
  request: ResolvedTestRunRequest;
}

export interface ITestCoverage {
  files: IFileCoverage[];
}

export interface ICoveredCount {
  covered: number;
  total: number;
}

export interface IFileCoverage {
  uri: URI;
  statement: ICoveredCount;
  branch?: ICoveredCount;
  function?: ICoveredCount;
  details?: CoverageDetails[];
}

export const enum DetailType {
  Function,
  Statement,
}

export type CoverageDetails = IFunctionCoverage | IStatementCoverage;

export interface IBranchCoverage {
  count: number;
  location?: IRange | IPosition;
}

export interface IFunctionCoverage {
  type: DetailType.Function;
  count: number;
  location?: IRange | IPosition;
}

export interface IStatementCoverage {
  type: DetailType.Statement;
  count: number;
  location: IRange | IPosition;
  branches?: IBranchCoverage[];
}

/**
 * Context for actions taken in the test explorer view.
 */
export interface ITestItemContext {
  /** Marshalling marker */
  $mid: 13 /** TestItemContext */;
  /** Tests and parents from the root to the current items */
  tests: InternalTestItem[];
}

/**
 * @private
 */
export interface IncrementalTestCollectionItem extends InternalTestItem {
  children: Set<string>;
}

/**
 * The IncrementalChangeCollector is used in the IncrementalTestCollection
 * and called with diff changes as they're applied. This is used in the
 * ext host to create a cohesive change event from a diff.
 */
export class IncrementalChangeCollector<T> {
  /**
   * A node was added.
   */
  public add(node: T): void {}

  /**
   * A node in the collection was updated.
   */
  public update(node: T): void {}

  /**
   * A node was removed.
   */
  public remove(node: T, isNestedOperation: boolean): void {}

  /**
   * Called when the diff has been applied.
   */
  public complete(): void {}
}

/**
 * Maintains tests in this extension host sent from the main thread.
 */
export abstract class AbstractIncrementalTestCollection<T extends IncrementalTestCollectionItem> {
  private readonly _tags = new Map<string, ITestTagDisplayInfo>();

  /**
   * Map of item IDs to test item objects.
   */
  protected readonly items = new Map<string, T>();

  /**
   * ID of test root items.
   */
  protected readonly roots = new Set<T>();

  /**
   * Number of 'busy' controllers.
   */
  protected busyControllerCount = 0;

  /**
   * Number of pending roots.
   */
  protected pendingRootCount = 0;

  /**
   * Known test tags.
   */
  public readonly tags: ReadonlyMap<string, ITestTagDisplayInfo> = this._tags;

  /**
   * Applies the diff to the collection.
   */
  public apply(diff: TestsDiff) {
    const changes = this.createChangeCollector();

    for (const op of diff) {
      switch (op[0]) {
        case TestDiffOpType.Add: {
          const internalTest = op[1];
          if (!internalTest.parent) {
            const created = this.createItem(internalTest);
            this.roots.add(created);
            this.items.set(internalTest.item.extId, created);
            changes.add(created);
          } else if (this.items.has(internalTest.parent)) {
            const parent = this.items.get(internalTest.parent)!;
            parent.children.add(internalTest.item.extId);
            const created = this.createItem(internalTest, parent);
            this.items.set(internalTest.item.extId, created);
            changes.add(created);
          }

          if (internalTest.expand === TestItemExpandState.BusyExpanding) {
            this.busyControllerCount++;
          }
          break;
        }

        case TestDiffOpType.Update: {
          const patch = op[1];
          const existing = this.items.get(patch.extId);
          if (!existing) {
            break;
          }

          if (patch.expand !== undefined) {
            if (existing.expand === TestItemExpandState.BusyExpanding) {
              this.busyControllerCount--;
            }
            if (patch.expand === TestItemExpandState.BusyExpanding) {
              this.busyControllerCount++;
            }
          }

          applyTestItemUpdate(existing, patch);
          changes.update(existing);
          break;
        }

        case TestDiffOpType.Remove: {
          const toRemove = this.items.get(op[1]);
          if (!toRemove) {
            break;
          }

          if (toRemove.parent) {
            const parent = this.items.get(toRemove.parent)!;
            parent.children.delete(toRemove.item.extId);
          } else {
            this.roots.delete(toRemove);
          }

          const queue: Iterable<string>[] = [[op[1]]];
          while (queue.length) {
            for (const itemId of queue.pop()!) {
              const existing = this.items.get(itemId);
              if (existing) {
                queue.push(existing.children);
                this.items.delete(itemId);
                changes.remove(existing, existing !== toRemove);

                if (existing.expand === TestItemExpandState.BusyExpanding) {
                  this.busyControllerCount--;
                }
              }
            }
          }
          break;
        }

        case TestDiffOpType.Retire:
          this.retireTest(op[1]);
          break;

        case TestDiffOpType.IncrementPendingExtHosts:
          this.updatePendingRoots(op[1]);
          break;

        case TestDiffOpType.AddTag:
          this._tags.set(op[1].id, op[1]);
          break;

        case TestDiffOpType.RemoveTag:
          this._tags.delete(op[1]);
          break;
      }
    }

    changes.complete();
  }

  /**
   * Called when the extension signals a test result should be retired.
   */
  protected retireTest(testId: string) {
    // no-op
  }

  /**
   * Updates the number of test root sources who are yet to report. When
   * the total pending test roots reaches 0, the roots for all controllers
   * will exist in the collection.
   */
  public updatePendingRoots(delta: number) {
    this.pendingRootCount += delta;
  }

  /**
   * Called before a diff is applied to create a new change collector.
   */
  protected createChangeCollector() {
    return new IncrementalChangeCollector<T>();
  }

  /**
   * Creates a new item for the collection from the internal test item.
   */
  protected abstract createItem(internal: InternalTestItem, parent?: T): T;
}

export class MainThreadTestCollection extends AbstractIncrementalTestCollection<IncrementalTestCollectionItem> {
  private busyProvidersChangeEmitter = new Emitter<number>();
  private retireTestEmitter = new Emitter<string>();
  private expandPromises = new WeakMap<
    IncrementalTestCollectionItem,
    {
      pendingLvl: number;
      doneLvl: number;
      prom: Promise<void>;
    }
  >();

  /**
   * @inheritdoc
   */
  public get busyProviders() {
    return this.busyControllerCount;
  }

  /**
   * @inheritdoc
   */
  public get rootItems() {
    return this.roots;
  }

  /**
   * @inheritdoc
   */
  public get all() {
    return this.getIterator();
  }

  public get rootIds() {
    return map(this.roots.values(), (r) => r.item.extId);
  }

  public readonly onBusyProvidersChange = this.busyProvidersChangeEmitter.event;
  public readonly onDidRetireTest = this.retireTestEmitter.event;

  constructor(private readonly expandActual: (id: string, levels: number) => Promise<void>) {
    super();
  }

  /**
   * @inheritdoc
   */
  public expand(testId: string, levels: number): Promise<void> {
    const test = this.items.get(testId);
    if (!test) {
      return Promise.resolve();
    }

    // simple cache to avoid duplicate/unnecessary expansion calls
    const existing = this.expandPromises.get(test);
    if (existing && existing.pendingLvl >= levels) {
      return existing.prom;
    }

    const prom = this.expandActual(test.item.extId, levels);
    const record = { doneLvl: existing ? existing.doneLvl : -1, pendingLvl: levels, prom };
    this.expandPromises.set(test, record);

    return prom.then(() => {
      record.doneLvl = levels;
    });
  }

  /**
   * @inheritdoc
   */
  public getNodeById(id: string) {
    return this.items.get(id);
  }

  /**
   * @inheritdoc
   */
  public getReviverDiff() {
    const ops: TestsDiff = [[TestDiffOpType.IncrementPendingExtHosts, this.pendingRootCount]];

    const queue = [this.rootIds];
    while (queue.length) {
      for (const child of queue.pop()!) {
        const item = this.items.get(child)!;
        ops.push([
          TestDiffOpType.Add,
          {
            controllerId: item.controllerId,
            expand: item.expand,
            item: item.item,
            parent: item.parent,
          },
        ]);
        queue.push(item.children);
      }
    }

    return ops;
  }

  /**
   * Applies the diff to the collection.
   */
  public override apply(diff: TestsDiff) {
    const prevBusy = this.busyControllerCount;
    super.apply(diff);

    if (prevBusy !== this.busyControllerCount) {
      this.busyProvidersChangeEmitter.fire(this.busyControllerCount);
    }
  }

  /**
   * Clears everything from the collection, and returns a diff that applies
   * that action.
   */
  public clear() {
    const ops: TestsDiff = [];
    for (const root of this.roots) {
      ops.push([TestDiffOpType.Remove, root.item.extId]);
    }

    this.roots.clear();
    this.items.clear();

    return ops;
  }

  /**
   * @override
   */
  protected createItem(internal: InternalTestItem): IncrementalTestCollectionItem {
    return { ...internal, children: new Set() };
  }

  /**
   * @override
   */
  protected override retireTest(testId: string) {
    this.retireTestEmitter.fire(testId);
  }

  private *getIterator() {
    const queue = [this.rootIds];
    while (queue.length) {
      for (const id of queue.pop()!) {
        const node = this.getNodeById(id)!;
        yield node;
        queue.push(node.children);
      }
    }
  }
}
