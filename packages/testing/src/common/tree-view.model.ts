import { Event } from '@opensumi/ide-core-common';

import { InternalTestItem, TestResultState } from './testCollection';

export const TestTreeViewModelToken = Symbol('TestTreeViewModel');

export interface ITestTreeViewModel {

  roots: Iterable<ITestTreeItem>;
  onUpdate: Event<void>;

  initTreeModel(): Promise<void>;

  expandElement(element: ITestTreeItem, depth: number): void;

}

export interface ITestTreeItem {
  state: TestResultState;

  test: InternalTestItem;

  parent: ITestTreeItem | undefined;

  children: Set<ITestTreeItem>;

  depth: number;

  tests: InternalTestItem[];

  duration: number | undefined;

  label: string;
}
