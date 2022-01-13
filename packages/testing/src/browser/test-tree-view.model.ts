import { ITestTreeData } from './../common/tree-view.model';
import { applyTestItemUpdate, ITestItemUpdate } from './../common/testCollection';
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

export class TestTreeItem implements ITestTreeItem {
  constructor(public test: InternalTestItem, public parent: ITestTreeItem | undefined) {}

  readonly children = new Set<TestTreeItem>();

  get label() {
    return this.test.item.label;
  }

  state = TestResultState.Unset;

  depth: number = this.parent ? this.parent.depth + 1 : 0;

  get tests() {
    return [this.test];
  }

  update = (patch: ITestItemUpdate) => {
    applyTestItemUpdate(this.test, patch);
  };

  duration: number | undefined;
}

@Injectable()
export class TestTreeViewModelImpl extends Disposable implements ITestTreeViewModel {
  @Autowired(TestServiceToken)
  private readonly testService: ITestService;

  protected readonly items = new Map<string, TestTreeItem>();

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

  protected getRevealDepth(element: TestTreeItem): number | undefined {
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
    }
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
