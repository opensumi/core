import { BinaryBuffer, Event, IAccessibilityInformation, IDisposable } from '@opensumi/ide-core-common';
import { ThemeType } from '@opensumi/ide-theme';

import { MarkdownString, ThemeIcon, TreeItemCollapsibleState } from './ext-types';
import { ICommand, UriComponents } from './models';

import type { CancellationToken } from '@opensumi/ide-core-common';
import type vscode from 'vscode';

export interface ITreeViewRevealOptions {
  select?: boolean;
  focus?: boolean;
  expand?: boolean | number;
}

export interface IMainThreadTreeView {
  $unregisterTreeDataProvider(treeViewId: string): Promise<void>;
  $registerTreeDataProvider<T>(treeViewId: string, options: TreeViewBaseOptions): Promise<void>;
  $refresh<T>(treeViewId: string, itemsToRefresh?: T | null): Promise<void>;
  $refresh(treeViewId: string, itemsToRefresh?: TreeViewItem): Promise<void>;
  $reveal(treeViewId: string, treeItemId?: string, options?: ITreeViewRevealOptions): Promise<any>;
  $setTitle(treeViewId: string, message: string): Promise<void>;
  $setDescription(treeViewId: string, message: string): Promise<void>;
  $setBadge(treeViewId: string, badge?: ViewBadge): void;
  $setMessage(treeViewId: string, message: string): Promise<void>;
  $resolveDropFileData(treeViewId: string, requestId: number, dataItemId: string): Promise<BinaryBuffer>;
}

export interface IExtHostTreeView {
  createTreeView<T extends vscode.TreeItem>(
    treeViewId: string,
    options: { treeDataProvider: vscode.TreeDataProvider<T> },
  ): TreeView<T>;
  registerTreeDataProvider<T extends vscode.TreeItem>(
    treeViewId: string,
    treeDataProvider: vscode.TreeDataProvider<T>,
  ): IDisposable;
  $getChildren(treeViewId: string, treeItemId?: string): Promise<TreeViewItem[] | undefined>;
  $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any>;
  $setSelection(treeViewId: string, treeItemHandles: string[]): void;
  $setVisible(treeViewId: string, visible: boolean): void;
  $checkStateChanged(treeViewId: string, items: { treeItemId: string; checked: boolean }[]): Promise<void>;
  $resolveTreeItem(treeViewId: string, treeItemId: string, token: CancellationToken): Promise<TreeViewItem | undefined>;
  $handleDrop(
    destinationViewId: string,
    requestId: number,
    treeDataTransfer: DataTransferDTO,
    targetHandle: string | undefined,
    token: CancellationToken,
    operationUuid?: string,
    sourceViewId?: string,
    sourceTreeItemHandles?: string[],
  ): Promise<void>;
  $handleDrag(
    sourceViewId: string,
    sourceTreeItemHandles: string[],
    operationUuid: string,
    token: CancellationToken,
  ): Promise<DataTransferDTO | undefined>;
}

// TreeView API Interface dependencies

export type IconUrl = string | { [index in ThemeType]: string };

export interface ITreeItemLabel {
  /**
   * 展示文本
   */
  label: string;
  /**
   * 高亮展示部分文本内容
   */
  highlights?: [number, number][];
  /**
   * 是否展示为删除线文本
   */
  strikethrough?: boolean;
}

export interface TreeViewItemCheckboxInfo {
  checked: boolean;
  tooltip?: string;
  accessibilityInformation?: IAccessibilityInformation;
}

export enum TreeItemCheckboxState {
  Unchecked = 0,
  Checked = 1,
}

export class TreeViewItem {
  id: string;

  label: string | ITreeItemLabel;

  icon?: string;

  description?: string;

  iconUrl?: IconUrl;

  themeIcon?: ThemeIcon;

  resourceUri?: UriComponents;

  tooltip?: MarkdownString | string;

  collapsibleState?: TreeItemCollapsibleState;

  contextValue?: string;

  checkboxInfo?: TreeViewItemCheckboxInfo;

  command?: ICommand;

  accessibilityInformation?: IAccessibilityInformation;
}

export interface TreeView<T> extends vscode.TreeView<T> {
  /**
   * 当节点展开时触发的事件
   */
  readonly onDidExpandElement: Event<vscode.TreeViewExpansionEvent<T>>;
  /**
   * 当节点折叠状态变化时触发的事件
   */
  readonly onDidCollapseElement: Event<vscode.TreeViewExpansionEvent<T>>;
  /**
   * 当节点可见性变化时触发的事件
   */
  readonly onDidChangeVisibility: Event<vscode.TreeViewVisibilityChangeEvent>;

  /**
   * 表示元素已被选中或未选中的事件。
   */
  readonly onDidChangeCheckboxState: Event<vscode.TreeCheckboxChangeEvent<T>>;

  /**
   * 当节点选中时触发的事件
   */
  readonly onDidChangeSelection: Event<vscode.TreeViewSelectionChangeEvent<T>>;
  /**
   * 当TreeView视图可见时为 true，否则为false
   */
  readonly visible: boolean;
  /**
   * 当前选中的节点
   */
  readonly selection: T[];
  /**
   * 节点上的
   * Setting the message to null, undefined, or empty string will remove the message from the view.
   */
  message?: string;
  /**
   * TreeView 视图标题
   */
  title?: string;
  /**
   * 可选的节点描述信息
   */
  description?: string;
  /**
   * TreeView 要显示的徽标
   * 要删除徽标，请设置为undefined
   */
  badge?: ViewBadge | undefined;
  /**
   * 展示节点，默认情况下展示的节点为选中状态
   *
   * 当希望显示的节点不带选中状态时，可以设置options内的select属性为false
   *
   * **NOTE:** 需要在实现TreeDataProvider.getParent接口情况下该接口才可用.
   */
  reveal(element: T, options?: { select?: boolean; focus?: boolean; expand?: boolean | number }): PromiseLike<void>;

  dispose(): void;
}

/**
 * 展示视图数值的徽标
 */
export interface ViewBadge {
  /**
   * 在徽标工具提示中显示的标签
   */
  readonly tooltip: string;

  /**
   * 徽标中显示的值
   */
  readonly value: number;
}

export interface TreeViewBaseOptions {
  /**
   * 手动管理复选框状态
   */
  manageCheckboxStateManually?: boolean;

  /**
   * 是否展示折叠所有功能（panel上功能）
   */
  showCollapseAll?: boolean;

  /**
   * Tree是否支持复选操作
   * 当值为true且命令在Tree上被执行时，第一个参数是选中执行的节点，第二个参数为所有选中的Tree节点数组

   */
  canSelectMany?: boolean;
  /**
   * 支持的 Drop Mime Type 类型
   * ref：
   */
  dropMimeTypes?: readonly string[];
  /**
   * 支持的 Drag Mime Type 类型
   */
  dragMimeTypes?: readonly string[];
  /**
   * 是否存在 Drag 处理函数
   */
  hasHandleDrag: boolean;
  /**
   * 是否存在 Drop 处理函数
   */
  hasHandleDrop: boolean;
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

export interface IDataTransferFileDTO {
  readonly name: string;
  readonly uri?: UriComponents;
}

export interface DataTransferItemDTO {
  readonly id: string;
  readonly asString: string;
  readonly fileData: IDataTransferFileDTO | undefined;
}

export interface DataTransferDTO {
  readonly items: Array<[/* type */ string, DataTransferItemDTO]>;
}

export const ITreeViewsService = Symbol('ITreeViewsService');

export interface ITreeViewsService<T, U, V> {
  readonly _serviceBrand: undefined;

  removeDragOperationTransfer(uuid: string | undefined): Promise<T | undefined> | undefined;
  addDragOperationTransfer(uuid: string, transferPromise: Promise<T | undefined>): void;

  getRenderedTreeElement(node: U): V | undefined;
  addRenderedTreeItemElement(node: U, element: V): void;
  removeRenderedTreeItemElement(node: U): void;
}

export class TreeviewsService<T, U, V> implements ITreeViewsService<T, U, V> {
  _serviceBrand: undefined;
  private _dragOperations: Map<string, Promise<T | undefined>> = new Map();
  private _renderedElements: Map<U, V> = new Map();

  removeDragOperationTransfer(uuid: string | undefined): Promise<T | undefined> | undefined {
    if (uuid && this._dragOperations.has(uuid)) {
      const operation = this._dragOperations.get(uuid);
      this._dragOperations.delete(uuid);
      return operation;
    }
    return undefined;
  }

  addDragOperationTransfer(uuid: string, transferPromise: Promise<T | undefined>): void {
    this._dragOperations.set(uuid, transferPromise);
  }

  getRenderedTreeElement(node: U): V | undefined {
    if (this._renderedElements.has(node)) {
      return this._renderedElements.get(node);
    }
    return undefined;
  }

  addRenderedTreeItemElement(node: U, element: V): void {
    this._renderedElements.set(node, element);
  }

  removeRenderedTreeItemElement(node: U): void {
    if (this._renderedElements.has(node)) {
      this._renderedElements.delete(node);
    }
  }
}
