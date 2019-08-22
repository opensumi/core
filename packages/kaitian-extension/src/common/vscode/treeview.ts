import * as vscode from 'vscode';
import {
  UriComponents,
  ICommand,
} from './models';
import { Event, IDisposable, SelectableTreeNode, ExpandableTreeNode, CompositeTreeNode } from '@ali/ide-core-common';
import { TreeItemCollapsibleState } from './ext-types';

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
  createTreeView<T>(treeViewId: string, options: { treeDataProvider: vscode.TreeDataProvider<T> }): TreeView<T>;
  registerTreeDataProvider<T>(treeViewId: string, treeDataProvider: vscode.TreeDataProvider<T>): IDisposable;
  $getChildren(treeViewId: string, treeItemId?: string): Promise<TreeViewItem[] | undefined>;
  $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any>;
  // $getChildren(treeViewId: string, treeItemHandle?: string): Promise<ITreeItem[]>;
  // $setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void;
  // $setSelection(treeViewId: string, treeItemHandles: string[]): void;
  // $setVisible(treeViewId: string, visible: boolean): void;
}

// TreeView API Interface dependencies

export type IconUrl = string | { light: string; dark: string; };

export class TreeViewItem {

  id: string;

  label: string;

  icon?: string;
  iconUrl?: IconUrl;

  themeIconId?: 'folder' | 'file';

  resourceUri?: UriComponents;

  tooltip?: string;

  collapsibleState?: TreeItemCollapsibleState;

  contextValue?: string;

  command?: ICommand;

}

export interface TreeView<T> extends IDisposable {
  /**
   * 当节点展开时触发的事件
   */
  readonly onDidExpandElement: Event<vscode.TreeViewExpansionEvent<T>>;

  /**
   * 当节点折叠时触发的事件
   */
  readonly onDidCollapseElement: Event<vscode.TreeViewExpansionEvent<T>>;

  /**
   * 当前选中的节点
   */
  readonly selection: ReadonlyArray<T>;

  /**
   * 展示节点，默认情况下展示的节点为选中状态
   *
   * 当希望显示的节点不带选中状态时，可以设置options内的select属性为false
   *
   * **NOTE:** 需要在实现TreeDataProvider.getParent接口情况下该接口才可用.
   */
  reveal(element: T, options?: { select?: boolean, focus?: boolean, expand?: boolean | number }): PromiseLike<void>;
}

export interface TreeViewOptions<T> {
  treeDataProvider: vscode.TreeDataProvider<T>;
}

export interface TreeViewNode extends SelectableTreeNode {
  contextValue?: string;
  command?: ICommand;
}

export interface CompositeTreeViewNode extends TreeViewNode, ExpandableTreeNode, CompositeTreeNode {
}

export interface TreeViewSelection {
  treeViewId: string;
  treeItemId: string;
}
export namespace TreeViewSelection {
  export function is(arg: any): arg is TreeViewSelection {
    return !!arg && typeof arg === 'object' && 'treeViewId' in arg && 'treeItemId' in arg;
  }
}
