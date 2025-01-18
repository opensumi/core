import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  CancellationTokenSource,
  Disposable,
  DisposableStore,
  Emitter,
  Event,
  IDisposable,
  Uri,
  asPromise,
  isNumber,
  isString,
  isUndefined,
  randomString,
  toDisposable,
} from '@opensumi/ide-core-common';

import {
  DataTransferDTO,
  IExtHostTreeView,
  IMainThreadTreeView,
  ITreeItemLabel,
  ITreeViewRevealOptions,
  ITreeViewsService,
  MainThreadAPIIdentifier,
  TreeItemCheckboxState,
  TreeView,
  TreeViewItem,
  TreeViewSelection,
  TreeviewsService,
  ViewBadge,
} from '../../../common/vscode';
import { DataTransfer } from '../../../common/vscode/converter';
import * as types from '../../../common/vscode/ext-types';

import { ExtHostCommands } from './ext.host.command';

import type { CancellationToken } from '@opensumi/ide-core-common';
import type vscode from 'vscode';

type Root = null | undefined | void;
interface TreeData<T> {
  message: boolean;
  element: T | T[] | Root | false;
}

export class ExtHostTreeViews implements IExtHostTreeView {
  private proxy: IMainThreadTreeView;

  private treeViews: Map<string, ExtHostTreeView<any>> = new Map<string, ExtHostTreeView<any>>();
  private treeDragAndDropService: ITreeViewsService<vscode.DataTransfer, any, any> = new TreeviewsService<
    vscode.DataTransfer,
    any,
    any
  >();

  constructor(rpc: IRPCProtocol, private readonly extHostCommand: ExtHostCommands) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadTreeView);

    extHostCommand.registerArgumentProcessor({
      processArgument: (arg) => {
        if (!TreeViewSelection.is(arg)) {
          return arg;
        }
        const { treeViewId, treeItemId } = arg;
        const treeView = this.treeViews.get(treeViewId);
        return treeView && treeView.getTreeItem(treeItemId);
      },
    });
  }

  registerTreeDataProvider<T extends vscode.TreeItem>(
    treeViewId: string,
    treeDataProvider: vscode.TreeDataProvider<T>,
  ): IDisposable {
    const treeView = this.createTreeView(treeViewId, { treeDataProvider });

    return Disposable.create(() => {
      this.treeViews.delete(treeViewId);
      treeView.dispose();
    });
  }

  createTreeView<T extends vscode.TreeItem>(treeViewId: string, options: vscode.TreeViewOptions<T>): TreeView<T> {
    if (!options || !options.treeDataProvider) {
      throw new Error('Options with treeDataProvider is mandatory');
    }

    const treeView = new ExtHostTreeView(treeViewId, options, this.proxy, this.extHostCommand);
    this.treeViews.set(treeViewId, treeView);

    return {
      get onDidExpandElement() {
        return treeView.onDidExpandElement;
      },
      get onDidCollapseElement() {
        return treeView.onDidCollapseElement;
      },
      get selection() {
        return treeView.selectedElements;
      },
      get onDidChangeSelection() {
        return treeView.onDidChangeSelection;
      },
      get visible() {
        return treeView.visible;
      },
      get onDidChangeVisibility() {
        return treeView.onDidChangeVisibility;
      },
      get onDidChangeCheckboxState() {
        return treeView.onDidChangeCheckboxState;
      },
      get message(): string {
        return treeView.message;
      },
      set message(message: string) {
        treeView.message = message;
      },
      get title(): string {
        return treeView.title;
      },
      set title(title: string) {
        treeView.title = title;
      },
      get description(): string {
        return treeView.description;
      },
      set description(description: string) {
        treeView.description = description;
      },
      get badge(): ViewBadge | undefined {
        return treeView.badge;
      },
      set badge(badge: ViewBadge | undefined) {
        treeView.badge = badge;
      },
      reveal: (element: T, options: ITreeViewRevealOptions): Thenable<void> => treeView.reveal(element, options),
      dispose: () => {
        this.treeViews.delete(treeViewId);
        treeView.dispose();
      },
    };
  }

  /**
   * 获取子节点
   * @param treeViewId
   * @param treeItemId 可选参数，如果不传则获取根节点
   */
  async $getChildren(treeViewId: string, treeItemId?: string): Promise<TreeViewItem[] | undefined> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }

    return treeView.getChildren(treeItemId);
  }

  /**
   * 获取子节点
   * @param treeViewId
   * @param treeItemId
   */
  async $resolveTreeItem(
    treeViewId: string,
    treeItemId: string,
    token: CancellationToken,
  ): Promise<TreeViewItem | undefined> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }

    return treeView.resolveTreeItem(treeItemId, token);
  }

  /**
   * 设置节点展开属性
   * @param treeViewId
   * @param treeItemId
   * @param expanded
   */
  async $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }

    if (expanded) {
      return treeView.onExpanded(treeItemId);
    } else {
      return treeView.onCollapsed(treeItemId);
    }
  }

  /**
   * 设置选中的节点
   * @param treeViewId
   * @param treeItemIds
   */
  async $setSelection(treeViewId: string, treeItemIds: string[]): Promise<void> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }
    treeView.setSelection(treeItemIds);
  }

  /**
   * 设置节点是否可见
   * @param treeViewId
   * @param isVisible
   */
  async $setVisible(treeViewId: string, isVisible: boolean): Promise<void> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }
    treeView.setVisible(isVisible);
  }

  /**
   * 设置节点的选择状态
   * @param treeViewId
   * @param items
   * @returns
   */
  $checkStateChanged(treeViewId: string, items: { treeItemId: string; checked: boolean }[]): Promise<void> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id ' + treeViewId);
    }
    return treeView.checkStateChanged(items);
  }

  async $handleDrop(
    destinationViewId: string,
    requestId: number,
    treeDataTransferDTO: DataTransferDTO,
    targetItemHandle: string | undefined,
    token: CancellationToken,
    operationUuid?: string,
    sourceViewId?: string,
    sourceTreeItemHandles?: string[],
  ): Promise<void> {
    const treeView = this.treeViews.get(destinationViewId);
    if (!treeView) {
      return Promise.reject(new Error(`No tree view with id '${destinationViewId}' registered.`));
    }

    const treeDataTransfer = DataTransfer.toDataTransfer(
      treeDataTransferDTO,
      async (dataItemIndex) =>
        (await this.proxy.$resolveDropFileData(destinationViewId, requestId, dataItemIndex)).buffer,
    );
    if (sourceViewId === destinationViewId && sourceTreeItemHandles) {
      await this.addAdditionalTransferItems(treeDataTransfer, treeView, sourceTreeItemHandles, token, operationUuid);
    }
    return treeView.onDrop(treeDataTransfer, targetItemHandle, token);
  }

  private async addAdditionalTransferItems(
    treeDataTransfer: vscode.DataTransfer,
    treeView: ExtHostTreeView<any>,
    sourceTreeItemHandles: string[],
    token: CancellationToken,
    operationUuid?: string,
  ): Promise<vscode.DataTransfer | undefined> {
    const existingTransferOperation = this.treeDragAndDropService.removeDragOperationTransfer(operationUuid);
    if (existingTransferOperation) {
      (await existingTransferOperation)?.forEach((value, key) => {
        if (value) {
          treeDataTransfer.set(key, value);
        }
      });
    } else if (operationUuid && treeView.handleDrag) {
      const willDropPromise = treeView.handleDrag(sourceTreeItemHandles, treeDataTransfer, token);
      this.treeDragAndDropService.addDragOperationTransfer(operationUuid, willDropPromise);
      await willDropPromise;
    }
    return treeDataTransfer;
  }

  async $handleDrag(
    sourceViewId: string,
    sourceTreeItemHandles: string[],
    operationUuid: string,
    token: CancellationToken,
  ): Promise<DataTransferDTO | undefined> {
    const treeView = this.treeViews.get(sourceViewId);
    if (!treeView) {
      return Promise.reject(new Error(`No tree view with id '${sourceViewId}' registered.`));
    }

    const treeDataTransfer = await this.addAdditionalTransferItems(
      new types.DataTransfer(),
      treeView,
      sourceTreeItemHandles,
      token,
      operationUuid,
    );
    if (!treeDataTransfer) {
      return;
    }

    return DataTransfer.toDataTransferDTO(treeDataTransfer);
  }
}

class ExtHostTreeView<T extends vscode.TreeItem> implements IDisposable {
  private onDidExpandElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<
    vscode.TreeViewExpansionEvent<T>
  >();
  public readonly onDidExpandElement = this.onDidExpandElementEmitter.event;

  private onDidCollapseElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<
    vscode.TreeViewExpansionEvent<T>
  >();
  public readonly onDidCollapseElement = this.onDidCollapseElementEmitter.event;

  private readonly onDidChangeSelectionEmitter = new Emitter<vscode.TreeViewSelectionChangeEvent<T>>();
  readonly onDidChangeSelection = this.onDidChangeSelectionEmitter.event;

  private readonly onDidChangeVisibilityEmitter = new Emitter<vscode.TreeViewVisibilityChangeEvent>();
  readonly onDidChangeVisibility = this.onDidChangeVisibilityEmitter.event;

  private readonly onDidChangeCheckboxStateEmitter = new Emitter<vscode.TreeCheckboxChangeEvent<T>>();
  readonly onDidChangeCheckboxState = this.onDidChangeCheckboxStateEmitter.event;

  private _visible = false;

  private selectedItemIds = new Set<string>();

  private id2Element: Map<string, T> = new Map<string, T>();
  private element2TreeViewItem: Map<T, TreeViewItem> = new Map<T, TreeViewItem>();
  private element2VSCodeTreeItem: Map<T, vscode.TreeItem> = new Map<T, vscode.TreeItem>();

  private disposable: DisposableStore = new DisposableStore();

  private readonly dataProvider: vscode.TreeDataProvider<T>;
  private readonly dndController: vscode.TreeDragAndDropController<T> | undefined;

  private _onDidChangeData: Emitter<TreeData<T>> = new Emitter<TreeData<T>>();

  private _title: string;
  private _description: string;
  private _message: string;
  private _badge?: ViewBadge = undefined;

  private roots: TreeViewItem[] | undefined = undefined;
  private nodes: Map<T, TreeViewItem[] | undefined> = new Map();

  private refreshPromise: Promise<void> = Promise.resolve();
  private refreshQueue: Promise<void> = Promise.resolve();

  constructor(
    private treeViewId: string,
    private options: vscode.TreeViewOptions<T>,
    private proxy: IMainThreadTreeView,
    private commands: ExtHostCommands,
  ) {
    this.dataProvider = this.options.treeDataProvider;
    this.dndController = this.options.dragAndDropController;
    const dropMimeTypes = this.dndController?.dropMimeTypes ?? [];
    const dragMimeTypes = this.dndController?.dragMimeTypes ?? [];
    const hasHandleDrag = !!this.dndController?.handleDrag;
    const hasHandleDrop = !!this.dndController?.handleDrop;

    this.disposable.add(this._onDidChangeData);
    // 将 options 直接取值，避免循环引用导致序列化异常
    proxy.$registerTreeDataProvider(treeViewId, {
      manageCheckboxStateManually: options.manageCheckboxStateManually,
      showCollapseAll: !!options.showCollapseAll,
      canSelectMany: !!options.canSelectMany,
      dropMimeTypes,
      dragMimeTypes,
      hasHandleDrag,
      hasHandleDrop,
    });

    if (this.dataProvider.onDidChangeTreeData) {
      const dispose = this.dataProvider.onDidChangeTreeData((itemToRefresh) => {
        this._onDidChangeData.fire({ element: itemToRefresh, message: false });
      });
      if (dispose) {
        this.disposable.add(dispose);
      }
    }

    this.disposable.add(toDisposable(() => this.id2Element.clear()));
    this.disposable.add(toDisposable(() => this.element2TreeViewItem.clear()));
    this.disposable.add(toDisposable(() => this.element2VSCodeTreeItem.clear()));
    this.disposable.add(toDisposable(() => this.nodes.clear()));
    this.disposable.add(toDisposable(() => proxy.$unregisterTreeDataProvider(treeViewId)));
    let refreshingPromise: Promise<void> | null;
    let promiseCallback: () => void;
    this.disposable.add(
      Event.debounce<TreeData<T>, { message: boolean; elements: (T | Root)[] }>(
        this.onDidChangeData,
        (result, current) => {
          if (!result) {
            result = { message: false, elements: [] };
          }
          if (current.element !== false) {
            if (!refreshingPromise) {
              refreshingPromise = new Promise((c) => (promiseCallback = c));
              this.refreshPromise = this.refreshPromise.then(() => refreshingPromise!);
            }
            if (Array.isArray(current.element)) {
              result.elements.push(...current.element);
            } else {
              result.elements.push(current.element);
            }
          }
          if (current.message) {
            result.message = true;
          }
          return result;
        },
        200,
        true,
      )(({ message, elements }) => {
        if (elements.length) {
          this.refreshQueue = this.refreshQueue.then(() => {
            const _promiseCallback = promiseCallback;
            refreshingPromise = null;
            return this.refresh(elements).then(() => _promiseCallback());
          });
        }
        if (message) {
          this.proxy.$setMessage(this.treeViewId, this._message);
        }
      }),
    );
  }

  private _refreshCancellationSource = new CancellationTokenSource();

  private refresh(elements: (T | Root)[]): Promise<void> {
    const hasRoot = elements.some((element) => !element);
    // 当存在根节点时，整颗树刷新，无需考虑子节点情况
    if (hasRoot) {
      // 取消正在进行的刷新操作
      this._refreshCancellationSource.cancel();
      this._refreshCancellationSource = new CancellationTokenSource();
      this.clearCache();
      return this.proxy.$refresh(this.treeViewId);
    } else {
      // TODO: 这里可以根据路径关系进一步合并多余的刷新操作，目前实现必要性不大
      const handlesToRefresh = this.getTreesNodeToRefresh(elements as T[]);
      if (handlesToRefresh.length) {
        return this.refreshTreeNodes(handlesToRefresh);
      }
    }
    return Promise.resolve(undefined);
  }

  private clearCache() {
    this.roots = undefined;
    this.nodes.clear();
    this.id2Element.clear();
    this.element2TreeViewItem.clear();
    this.element2VSCodeTreeItem.clear();
  }

  private getTreesNodeToRefresh(elements: T[]) {
    const treeNodeToUpdate = new Set<TreeViewItem>();
    const nodes = elements.map((element) => {
      const treeViewItem = this.element2TreeViewItem.get(element);
      if (treeViewItem) {
        return treeViewItem;
      }
    });
    for (const node of nodes) {
      if (node) {
        treeNodeToUpdate.add(node);
      }
    }
    return Array.from(treeNodeToUpdate);
  }

  private async refreshTreeNodes(itemHandles: TreeViewItem[]) {
    await Promise.all(itemHandles.map((itemsToRefresh) => this.proxy.$refresh(this.treeViewId, itemsToRefresh)));
  }

  dispose() {
    this._refreshCancellationSource.dispose();
    this.disposable.dispose();
  }

  get onDidChangeData() {
    return this._onDidChangeData.event;
  }

  get title() {
    return this._title;
  }

  set title(value: string) {
    this.proxy.$setTitle(this.treeViewId, value);
    this._title = value;
  }

  get description() {
    return this._description;
  }

  set description(value: string) {
    this.proxy.$setDescription(this.treeViewId, value);
    this._description = value;
  }

  get message() {
    return this._message;
  }

  set message(value: string) {
    this._message = value;
    this._onDidChangeData.fire({ message: true, element: false });
  }

  get visible(): boolean {
    return this._visible;
  }

  get badge(): ViewBadge | undefined {
    return this._badge;
  }
  set badge(badge: ViewBadge | undefined) {
    this._badge = badge;
    this.proxy.$setBadge(this.treeViewId, badge);
  }

  get selectedElements(): T[] {
    const items: T[] = [];
    for (const id of this.selectedItemIds) {
      const item = this.getTreeItem(id);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }

  async reveal(element: T, options?: ITreeViewRevealOptions): Promise<void> {
    // 在缓存中查找对应节点
    let elementId = element.id;
    if (!elementId) {
      const treeViewItem = this.element2TreeViewItem.get(element);
      if (treeViewItem) {
        elementId = treeViewItem.id;
      }
    }

    if (typeof this.dataProvider.getParent !== 'function') {
      throw new Error("Required registered TreeDataProvider to implement 'getParent' method to access 'reveal' method");
    }

    await this.refreshPromise;

    if (elementId) {
      const revealOptions = {
        expand: options?.expand,
        focus: options?.focus,
        select: options?.select,
      } as ITreeViewRevealOptions;

      await this.proxy.$reveal(this.treeViewId, elementId, revealOptions);
    } else {
      // need reveal the root
      await this.proxy.$reveal(this.treeViewId, undefined, options);
    }
  }

  getViewTreeId(value: T, treeItem: vscode.TreeItem): string {
    let id = value.id || treeItem.id;
    if (!id) {
      // 获取Label属性
      let label: string | ITreeItemLabel | undefined;
      const treeItemLabel: string | vscode.TreeItemLabel | undefined = treeItem.label;
      if (treeItemLabel) {
        label = treeItemLabel;
      }

      // 当没有指定label时尝试使用resourceUri
      if (!label && treeItem.resourceUri) {
        label = treeItem.resourceUri.path.toString();
        label = decodeURIComponent(label);
        if (label.indexOf('/') >= 0) {
          label = label.substring(label.lastIndexOf('/') + 1);
        }
      }

      const _label = isString(label) ? label : label?.label;
      id = [this.treeViewId, _label, randomString(4)].filter(Boolean).join(':');
    }

    return id;
  }

  private async resolveParentChain(element: T): Promise<T[]> {
    const parentChain: T[] = [];

    // will receive `null` or `undefined` if `element` is a child of root.
    let parent = await this.dataProvider.getParent!(element);
    while (parent) {
      parentChain.push(parent);
      parent = await this.dataProvider.getParent!(parent);
    }
    return parentChain;
  }

  getTreeItem(treeItemId?: string): T | undefined {
    if (treeItemId) {
      return this.id2Element.get(treeItemId);
    }
  }

  async handleDrag(
    sourceTreeItemHandles: string[],
    treeDataTransfer: vscode.DataTransfer,
    token: CancellationToken,
  ): Promise<vscode.DataTransfer | undefined> {
    const extensionTreeItems: T[] = [];
    for (const sourceHandle of sourceTreeItemHandles) {
      const extensionItem = this.getTreeItem(sourceHandle);
      if (extensionItem) {
        extensionTreeItems.push(extensionItem);
      }
    }

    if (!this.dndController?.handleDrag || extensionTreeItems.length === 0) {
      return;
    }
    await this.dndController.handleDrag(extensionTreeItems, treeDataTransfer, token);
    return treeDataTransfer;
  }

  get hasHandleDrag(): boolean {
    return !!this.dndController?.handleDrag;
  }

  async onDrop(
    treeDataTransfer: vscode.DataTransfer,
    targetHandleOrNode: string | undefined,
    token: CancellationToken,
  ): Promise<void> {
    const target = targetHandleOrNode ? this.getTreeItem(targetHandleOrNode) : undefined;
    if ((!target && targetHandleOrNode) || !this.dndController?.handleDrop) {
      return;
    }
    return asPromise(() =>
      this.dndController?.handleDrop ? this.dndController.handleDrop(target, treeDataTransfer, token) : undefined,
    );
  }

  async checkStateChanged(items: readonly { treeItemId: string; checked: boolean }[]): Promise<void> {
    const transformed: [T, TreeItemCheckboxState][] = [];
    items.forEach((item) => {
      const node = this.getTreeItem(item.treeItemId);
      if (node) {
        transformed.push([node, item.checked ? TreeItemCheckboxState.Checked : TreeItemCheckboxState.Unchecked]);
        const treeViewItem = this.element2TreeViewItem.get(node);
        if (treeViewItem && treeViewItem.checkboxInfo) {
          treeViewItem.checkboxInfo.checked = item.checked;
        }
      }
    });
    this.onDidChangeCheckboxStateEmitter.fire({
      items: transformed,
    });
  }

  /**
   * 在节点被点击或者打开时，获取原有的 command 为 undefined 时被调用
   * 在节点被 Hover 时，获取原有的 tooltip 为 undefined 时被调用
   */
  async resolveTreeItem(treeItemId: string, token: CancellationToken): Promise<TreeViewItem | undefined> {
    if (!this.dataProvider.resolveTreeItem) {
      return;
    }
    if (token.isCancellationRequested) {
      return;
    }
    const cache = this.getTreeItem(treeItemId);
    if (cache) {
      const node = this.element2VSCodeTreeItem.get(cache);
      if (!node) {
        return undefined;
      }
      const resolve = (await this.dataProvider.resolveTreeItem(node, cache, token)) ?? node;
      node.tooltip = resolve.tooltip;
      node.command = resolve.command;
      return this.toTreeViewItem(node);
    }
    return;
  }

  /**
   * Get the children of `element` or root if no element is passed.
   *
   * @param element The element from which the provider gets children. Can be `undefined`.
   * @return Children of `element` or root if no element is passed.
   */
  async resolveChildren(element?: T): Promise<TreeViewItem[] | undefined> {
    const treeItems: TreeViewItem[] = [];

    const results = await this.dataProvider.getChildren(element);
    if (!results) {
      return;
    }

    for (const value of results.values()) {
      // 遍历treeDataProvider获取的值生成节点
      if (this._refreshCancellationSource.token.isCancellationRequested) {
        return;
      }
      const treeViewItem = await this.cacheElement(value);
      treeItems.push(treeViewItem);
    }

    return treeItems;
  }

  async cacheElement(value: T): Promise<TreeViewItem> {
    const treeItem = await this.dataProvider.getTreeItem(value);

    const id = this.getViewTreeId(value, treeItem);
    this.id2Element.set(id, value);

    const treeViewItem = this.toTreeViewItem(treeItem, {
      id,
    });
    this.element2TreeViewItem.set(value, treeViewItem);
    this.element2VSCodeTreeItem.set(value, treeItem);

    return treeViewItem;
  }

  /**
   * @param treeItemId 可选参数，如果不传则获取根节点
   */
  async getChildren(treeItemId?: string): Promise<TreeViewItem[] | undefined> {
    // 缓存中获取节点
    const cachedElement = this.getTreeItem(treeItemId);

    // 没有 cachedElement 时，获取根节点，如果根节点已经初始化则直接返回
    if (!cachedElement && this.roots) {
      return this.roots;
    }

    let children: TreeViewItem[] | undefined;
    if (this._refreshCancellationSource.token.isCancellationRequested) {
      children = undefined;
    } else {
      const results = await this.resolveChildren(cachedElement);
      if (results) {
        if (this._refreshCancellationSource.token.isCancellationRequested) {
          children = undefined;
        } else {
          children = results;
        }
      } else {
        children = undefined;
      }
    }

    if (!cachedElement) {
      this.roots = children;
    } else {
      this.nodes.set(cachedElement, children);
    }
    return children;
  }

  /**
   * 将 treeItem 转换为 TreeViewItem 以便序列化处理
   * @param treeItem
   * @param props 额外追加的字段
   * @returns
   */
  private toTreeViewItem(treeItem: vscode.TreeItem, props?: Partial<TreeViewItem>): TreeViewItem {
    const { id, label, iconPath } = treeItem;
    let icon;
    let iconUrl;
    let themeIcon;

    if (typeof iconPath === 'string' && iconPath.indexOf('fa-') !== -1) {
      icon = iconPath;
    } else if (iconPath instanceof types.ThemeIcon) {
      themeIcon = iconPath;
    } else {
      const light = this.getLightIconPath(treeItem);
      const dark = this.getDarkIconPath(treeItem) || light;
      if (light) {
        iconUrl = {
          dark,
          light,
        };
      }
    }

    let checkboxInfo;
    if (isUndefined(treeItem.checkboxState)) {
      checkboxInfo = undefined;
    } else if (!isNumber(treeItem.checkboxState)) {
      checkboxInfo = {
        checked: treeItem.checkboxState.state === TreeItemCheckboxState.Checked,
        tooltip: treeItem.checkboxState.tooltip,
        accessibilityInformation: treeItem.checkboxState.accessibilityInformation,
      };
    } else {
      checkboxInfo = {
        checked: treeItem.checkboxState === TreeItemCheckboxState.Checked,
      };
    }

    const treeViewItem = {
      id,
      label,
      icon,
      iconUrl,
      themeIcon,
      description: treeItem.description,
      resourceUri: treeItem.resourceUri,
      tooltip: treeItem.tooltip,
      collapsibleState: treeItem.collapsibleState,
      contextValue: treeItem.contextValue,
      checkboxInfo,
      accessibilityInformation: treeItem.accessibilityInformation,
      command: treeItem.command ? this.commands.converter.toInternal(treeItem.command, this.disposable) : undefined,
      ...props,
    } as TreeViewItem;
    return treeViewItem;
  }

  async onExpanded(treeItemId: string): Promise<any> {
    // 从缓存中获取节点
    const cachedElement = this.getTreeItem(treeItemId);

    // 触发展开事件
    if (cachedElement) {
      this.onDidExpandElementEmitter.fire({
        element: cachedElement,
      });
    }
  }

  async onCollapsed(treeItemId: string): Promise<any> {
    const cachedElement = this.getTreeItem(treeItemId);

    // 触发折叠事件
    if (cachedElement) {
      this.onDidCollapseElementEmitter.fire({
        element: cachedElement,
      });
    }
  }

  private getDarkIconPath(extensionTreeItem: vscode.TreeItem): string | undefined {
    if (
      extensionTreeItem.iconPath &&
      !(extensionTreeItem.iconPath instanceof types.ThemeIcon) &&
      (extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark
    ) {
      return this.getIconPath((extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark);
    }
    return undefined;
  }

  private getLightIconPath(extensionTreeItem: vscode.TreeItem): string | undefined {
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof types.ThemeIcon)) {
      if (typeof extensionTreeItem.iconPath === 'string' || Uri.isUri(extensionTreeItem.iconPath)) {
        return this.getIconPath(extensionTreeItem.iconPath);
      }
      return this.getIconPath((extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).light);
    }
    return undefined;
  }

  private getIconPath(iconPath: string | Uri): string {
    if (Uri.isUri(iconPath)) {
      if (/^http(s)?/.test(iconPath.scheme)) {
        return iconPath.toString();
      } else if (/^image/.test(iconPath.path.toString())) {
        return `data:${iconPath.fsPath.toString()}`;
      }
      return iconPath.with({ scheme: '' }).toString();
    }
    return iconPath;
  }

  setVisible(visible: boolean): void {
    if (visible !== this._visible) {
      this._visible = visible;
      this.onDidChangeVisibilityEmitter.fire(Object.freeze({ visible: this._visible }));
    }
  }

  setSelection(selectedItemIds: string[]): void {
    this.doSetSelection(selectedItemIds);
  }

  protected doSetSelection(selectedItemIts: string[]): void {
    this.selectedItemIds = new Set(selectedItemIts);
    this.onDidChangeSelectionEmitter.fire(Object.freeze({ selection: this.selectedElements }));
  }
}
