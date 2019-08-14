import { TreeViewItem } from './ext-types';

export interface IMainThreadTreeView {
  $registerTreeDataProvider(treeViewId: string): void;
  $refresh(treeViewId: string): void;
  $reveal(treeViewId: string, treeItemId: string): Promise<any>;
  // $registerTreeViewDataProvider(treeViewId: string, options: { showCollapseAll: boolean }): void;
  // $refresh(treeViewId: string, itemsToRefresh?: { [treeItemHandle: string]: ITreeItem }): Promise<void>;
  // $reveal(treeViewId: string, treeItem: ITreeItem, parentChain: ITreeItem[], options: IRevealOptions): Promise<void>;
  // $setMessage(treeViewId: string, message: string | IMarkdownString): void;
}

export interface IExtHostTreeView {
  $getChildren(treeViewId: string, treeItemId: string | undefined): Promise<TreeViewItem[] | undefined>;
  $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any>;
  // $getChildren(treeViewId: string, treeItemHandle?: string): Promise<ITreeItem[]>;
  // $setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void;
  // $setSelection(treeViewId: string, treeItemHandles: string[]): void;
  // $setVisible(treeViewId: string, visible: boolean): void;
}
