import { Iterable } from '@opensumi/monaco-editor-core/esm/vs/base/common/iterator';
import { ITestTreeData } from './../common/tree-view.model';
import { applyTestItemUpdate, IncrementalTestCollectionItem, ITestItemUpdate } from './../common/testCollection';
import { Autowired, Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-components/lib/utils';
import { Disposable, isDefined, filter, map } from '@opensumi/ide-core-browser';

import { ITestService, TestServiceToken } from '../common';
import {
  InternalTestItem,
  TestDiffOpType,
  TestItemExpandState,
  TestResultState,
  TestsDiff,
} from '../common/testCollection';
import { ITestTreeItem, ITestTreeViewModel } from '../common/tree-view.model';
import { IRecycleTreeHandle, TreeNodeEvent } from '@opensumi/ide-components';
import { BasicCompositeTreeNode } from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { TestResultItemChange, TestResultItemChangeReason, TestResultServiceToken } from '../common/test-result';
import { ResultChangeEvent, TestResultServiceImpl } from './test.result.service';
import { IComputedStateAndDurationAccessor, refreshComputedState } from '../common/getComputedState';

const computedStateAccessor: IComputedStateAndDurationAccessor<ITestTreeItem> = {
  getOwnState: (i) => (i instanceof TestTreeItem ? i.ownState : TestResultState.Unset),
  getCurrentComputedState: (i) => i.state,
  setComputedState: (i, s) => (i.state = s),

  getCurrentComputedDuration: (i) => i.duration,
  getOwnDuration: (i) => (i instanceof TestTreeItem ? i.ownDuration : undefined),
  setComputedDuration: (i, d) => (i.duration = d),

  getChildren: (i) => Iterable.filter(i.children.values(), (t): t is TestTreeItem => t instanceof TestTreeItem),
  *getParents(i) {
    for (let parent = i.parent; parent; parent = parent.parent) {
      yield parent;
    }
  },
};

export class TestTreeItem implements ITestTreeItem {
  constructor(public test: InternalTestItem, public parent: ITestTreeItem | undefined) {}

  readonly children = new Set<TestTreeItem>();

  public get label() {
    return this.test.item.label;
  }

  public state = TestResultState.Unset;

  public ownState = TestResultState.Unset;

  public depth: number = this.parent ? this.parent.depth + 1 : 0;

  public get tests() {
    return [this.test];
  }

  public update = (patch: ITestItemUpdate) => {
    applyTestItemUpdate(this.test, patch);
  };

  public duration: number | undefined;

  public ownDuration: number | undefined;
}

@Injectable()
export class TestTreeViewModelImpl extends Disposable implements ITestTreeViewModel {
  @Autowired(TestServiceToken)
  private readonly testService: ITestService;

  @Autowired(TestResultServiceToken)
  private readonly testResultService: TestResultServiceImpl;

  private readonly items = new Map<string, TestTreeItem>();

  private readonly updateEmitter = new Emitter<void>();
  readonly onUpdate = this.updateEmitter.event;

  public treeHandlerApi: IRecycleTreeHandle;

  constructor() {
    super();
    this.addDispose(this.testService.onDidProcessDiff((diff) => this.applyDiff(diff)));
  }

  get roots(): Iterable<TestTreeItem> {
    const rootsIt = map(this.testService.collection.rootItems, (r) => this.items.get(r.item.extId));
    return filter(rootsIt, isDefined);
  }

  private getRevealDepth(element: TestTreeItem): number | undefined {
    return element.depth === 0 ? 0 : undefined;
  }

  private createItem(item: InternalTestItem): TestTreeItem {
    const parent = item.parent ? this.items.get(item.parent) : undefined;
    return new TestTreeItem(item, parent);
  }

  private didUpdateItem(item: TestTreeItem) {
    item.parent?.children.add(item);
    this.items.set(item.test.item.extId, item);
    const reveal = this.getRevealDepth(item);
    if (reveal !== undefined) {
      this.expandElement(item, reveal);
    }
  }

  private applyDiff(diff: TestsDiff) {
    for (const op of diff) {
      switch (op[0]) {
        case TestDiffOpType.Add: {
          const item = this.createItem(op[1]);
          this.didUpdateItem(item);
          break;
        }
        case TestDiffOpType.Update: {
          const patch = op[1];
          const existing = this.items.get(patch.extId);
          if (!existing) {
            break;
          }

          existing.update(patch);
          break;
        }
        case TestDiffOpType.Remove: {
          console.log('remove item>>>', op[1]);
          break;
        }
      }
    }

    if (diff.length !== 0) {
      this.updateEmitter.fire();
    }
  }

  private listenTreeHandlerEvent(): void {
    if (this.treeHandlerApi) {
      const model = this.treeHandlerApi.getModel();
      this.addDispose(
        model.root.watcher.on(TreeNodeEvent.DidChangeExpansionState, async (node: BasicCompositeTreeNode) => {
          if (node.expanded) {
            const raw = node.raw as ITestTreeData;
            const rawTest = raw.rawItem.test;
            if (
              rawTest.expand === TestItemExpandState.Expanded ||
              rawTest.expand === TestItemExpandState.NotExpandable
            ) {
              return;
            }

            await this.expandElement(raw.rawItem, raw.rawItem.depth);
            this.updateEmitter.fire();
            await node.refresh();
          }
        }),
      );
      this.addDispose(
        this.testResultService.onTestChanged((evt: TestResultItemChange) => {
          console.log('testResultService.onTestChanged', evt);

          if (evt.reason === TestResultItemChangeReason.ComputedStateChange) {
            const item = this.items.get(evt.item.item.extId);
            if (!item) {
              return;
            }

            refreshComputedState(computedStateAccessor, item, evt.item.computedState).forEach((e) => {
              console.log('refreshComputedState', e);
              item.state = evt.item.computedState;
            });

            this.updateEmitter.fire();
            // 在这里更新树图标
            return;
          }

          this.revealTreeById(evt.item.item.extId, false, false);
        }),
      );
      this.addDispose(
        this.testResultService.onResultsChanged((evt: ResultChangeEvent) => {
          if ('started' in evt) {
            console.log('testResultService.started', evt);
          }

          if ('completed' in evt) {
            console.log('testResultService.completed', evt);
          }
        }),
      );
    }
  }

  private revealTreeById(id: string | undefined, expand = true, focus = true): void {
    if (!id) {
      return;
    }

    // ** 此处要更新 tree 状态 **
  }

  public getTestItem(extId: string): IncrementalTestCollectionItem | undefined {
    return this.testService.collection.getNodeById(extId);
  }

  public expandElement(element: ITestTreeItem, depth: number): Promise<void> {
    if (!(element instanceof TestTreeItem)) {
      return Promise.resolve();
    }
    if (element.test.expand === TestItemExpandState.NotExpandable) {
      return Promise.resolve();
    }
    return this.testService.collection.expand(element.test.item.extId, depth);
  }

  public initTreeModel(): Promise<void> {
    // console.log('do initTreeModel');
    return Promise.resolve();
  }

  public setTreeHandlerApi(handle: IRecycleTreeHandle): void {
    this.treeHandlerApi = handle;
    this.listenTreeHandlerEvent();
  }
}
