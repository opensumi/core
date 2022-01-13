import { IBasicTreeData, IRecycleTreeHandle } from '@opensumi/ide-components';
import { Event } from '@opensumi/ide-core-browser';

import { InternalTestItem, TestResultState, IncrementalTestCollectionItem } from './testCollection';

export const TestTreeViewModelToken = Symbol('TestTreeViewModel');

export interface ITestTreeViewModel {
  roots: Iterable<ITestTreeItem>;
  onUpdate: Event<void>;

  initTreeModel(): Promise<void>;

  expandElement(element: ITestTreeItem, depth: number): void;

  setTreeHandlerApi(handle: IRecycleTreeHandle): void;

  getTestItem(extId: string): IncrementalTestCollectionItem | undefined;
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

export interface ITestTreeData extends IBasicTreeData {
  rawItem: ITestTreeItem;
}
