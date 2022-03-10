import { Autowired, Injectable } from '@opensumi/di';
import { CompositeTreeNode, IRecycleTreeHandle, TreeNodeEvent } from '@opensumi/ide-components';
import { BasicCompositeTreeNode } from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { Emitter } from '@opensumi/ide-components/lib/utils';
import { Disposable, isDefined, filter, map, getDebugLogger } from '@opensumi/ide-core-browser';
import { Iterable } from '@opensumi/monaco-editor-core/esm/vs/base/common/iterator';

import { ITestService, TestServiceToken } from '../common';
import { IComputedStateAndDurationAccessor, refreshComputedState } from '../common/getComputedState';
import { TestResultServiceToken } from '../common/test-result';
import {
  InternalTestItem,
  TestDiffOpType,
  TestItemExpandState,
  TestResultState,
  TestsDiff,
} from '../common/testCollection';
import { ITestTreeItem, ITestTreeViewModel } from '../common/tree-view.model';


import { applyTestItemUpdate, IncrementalTestCollectionItem, ITestItemUpdate } from './../common/testCollection';
import { ITestTreeData } from './../common/tree-view.model';
import { ResultChangeEvent, TestResultServiceImpl } from './test.result.service';

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

  public retired = false;
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

    for (const test of this.testService.collection.all) {
      this.didUpdateItem(this.createItem(test));
    }
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

  private findTestTreeItemByExtId(extId: string | undefined): CompositeTreeNode | undefined {
    if (!this.treeHandlerApi || !extId) {
      return;
    }

    const model = this.treeHandlerApi.getModel();
    if (!model) {
      return;
    }

    const findTreeItemByExtId = model.root.flattenedBranch!.find(
      (id) =>
        ((model.root.getTreeNodeById(id) as BasicCompositeTreeNode).raw as ITestTreeData).rawItem.test.item.extId ===
        extId,
    );
    const treeItem = model.root.getTreeNodeById(findTreeItemByExtId!) as CompositeTreeNode;
    return treeItem;
  }

  private didUnStoreItem(items: Map<string, TestTreeItem>, item: TestTreeItem) {
    const parent = item.parent;
    parent?.children.delete(item);
    items.delete(item.test.item.extId);
    if (parent instanceof TestTreeItem) {
      refreshComputedState(computedStateAccessor, parent);
    }

    return item.children;
  }

  private async didUpdateItem(item: TestTreeItem) {
    item.parent?.children.add(item);
    this.items.set(item.test.item.extId, item);
    const reveal = this.getRevealDepth(item);
    if (reveal !== undefined) {
      await this.expandElement(item, reveal);
    }

    const prevState = this.testResultService.getStateById(item.test.item.extId)?.[1];
    if (prevState) {
      item.retired = prevState.retired;
      item.ownState = prevState.computedState;
      item.ownDuration = prevState.ownDuration;
      refreshComputedState(computedStateAccessor, item);
    }
  }

  private async applyDiff(diff: TestsDiff) {
    for (const op of diff) {
      switch (op[0]) {
        case TestDiffOpType.Add: {
          const item = this.createItem(op[1]);
          await this.didUpdateItem(item);

          const treeItem = this.findTestTreeItemByExtId(item.parent?.test.item.extId);
          if (treeItem) {
            treeItem.refresh();
          }
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
          const toRemove = this.items.get(op[1]);
          if (!toRemove) {
            break;
          }

          const treeItem = this.findTestTreeItemByExtId(toRemove.test.item.extId);
          if (treeItem) {
            (treeItem.parent as CompositeTreeNode).unlinkItem(treeItem);
          }

          const queue: Iterable<TestTreeItem>[] = [[toRemove]];
          while (queue.length) {
            for (const item of queue.pop()!) {
              if (item instanceof TestTreeItem) {
                queue.push(this.didUnStoreItem(this.items, item));
              }
            }
          }

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
            if (rawTest.expand === TestItemExpandState.NotExpandable) {
              return;
            }

            await this.expandElement(raw.rawItem, raw.rawItem.depth);
            await node.refresh();
          }
        }),
      );
      this.addDispose(
        this.testResultService.onTestChanged(({ item: result }) => {
          if (result.ownComputedState === TestResultState.Unset) {
            const fallback = this.testResultService.getStateById(result.item.extId);
            if (fallback) {
              result = fallback[1];
            }
          }

          const item = this.items.get(result.item.extId);
          if (!item) {
            return;
          }

          item.retired = result.retired;
          item.ownState = result.ownComputedState;
          item.ownDuration = result.ownDuration;
          const explicitComputed = item.children.size ? undefined : result.computedState;
          refreshComputedState(computedStateAccessor, item, explicitComputed);
          model.dispatchChange();
          this.revealTreeById(result.item.extId, false, false);
          this.updateEmitter.fire();
        }),
      );
      this.addDispose(
        this.testResultService.onResultsChanged((evt: ResultChangeEvent) => {
          if (!('removed' in evt)) {
            return;
          }

          for (const inTree of [...this.items.values()].sort((a, b) => b.depth - a.depth)) {
            const lookup = this.testResultService.getStateById(inTree.test.item.extId)?.[1];
            inTree.ownDuration = lookup?.ownDuration;
            refreshComputedState(computedStateAccessor, inTree, lookup?.ownComputedState ?? TestResultState.Unset);
          }

          model.dispatchChange();
          this.updateEmitter.fire();
        }),
      );
    }
  }

  private revealTreeById(id: string | undefined, expand = true, focus = true): void {
    if (!id) {
      return;
    }

    // ** 此处要定位到对应 tree 位置 **
  }

  public getTestItem(extId: string): IncrementalTestCollectionItem | undefined {
    return this.testService.collection.getNodeById(extId);
  }

  public getTestTreeItem(extId: string): TestTreeItem | undefined {
    return this.items.get(extId);
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
    return Promise.resolve();
  }

  public setTreeHandlerApi(handle: IRecycleTreeHandle): void {
    this.treeHandlerApi = handle;
    this.listenTreeHandlerEvent();
  }
}
