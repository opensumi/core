import { Autowired, Injectable } from '@opensumi/di';
import { Emitter } from '@opensumi/ide-components/lib/utils';
import { Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { filter, map } from '@opensumi/ide-core-common/lib/iterator';
import { isDefined } from '@opensumi/ide-core-common/lib/utils';

import { ITestService, TestServiceToken } from '../common';
import {
  InternalTestItem,
  TestDiffOpType,
  TestItemExpandState,
  TestResultState,
  TestsDiff,
} from '../common/testCollection';
import { ITestTreeItem, ITestTreeViewModel } from '../common/tree-view.model';

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

  duration: number | undefined;
}

@Injectable()
export class TestTreeViewModelImpl extends Disposable implements ITestTreeViewModel {
  @Autowired(TestServiceToken)
  private readonly testService: ITestService;

  protected readonly items = new Map<string, TestTreeItem>();

  private readonly updateEmitter = new Emitter<void>();
  readonly onUpdate = this.updateEmitter.event;

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
          console.log('update item>>>', op[1]);
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

  expandElement(element: ITestTreeItem, depth: number): void {
    if (!(element instanceof TestTreeItem)) {
      return;
    }
    if (element.test.expand === TestItemExpandState.NotExpandable) {
      return;
    }
    this.testService.collection.expand(element.test.item.extId, depth);
  }

  initTreeModel(): Promise<void> {
    // console.log('do initTreeModel');
    return Promise.resolve();
  }
}
