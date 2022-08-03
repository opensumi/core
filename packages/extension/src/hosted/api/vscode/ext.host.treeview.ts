import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  IDisposable,
  Emitter,
  Disposable,
  Uri,
  DisposableStore,
  toDisposable,
  Event,
  CancellationTokenSource,
} from '@opensumi/ide-core-common';
import type { CancellationToken } from '@opensumi/ide-core-common';

import {
  IExtHostTreeView,
  IMainThreadTreeView,
  ITreeItemLabel,
  ITreeViewRevealOptions,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import { TreeView, TreeViewItem, TreeViewSelection, TreeViewOptions } from '../../../common/vscode';
import { ThemeIcon } from '../../../common/vscode/ext-types';

import { ExtHostCommands } from './ext.host.command';

type Root = null | undefined | void;
interface TreeData<T> {
  message: boolean;
  element: T | T[] | Root | false;
}

export class ExtHostTreeViews implements IExtHostTreeView {
  private proxy: IMainThreadTreeView;

  private treeViews: Map<string, ExtHostTreeView<any>> = new Map<string, ExtHostTreeView<any>>();

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

  registerTreeDataProvider<T>(treeViewId: string, treeDataProvider: vscode.TreeDataProvider<T>): IDisposable {
    const treeView = this.createTreeView(treeViewId, { treeDataProvider });

    return Disposable.create(() => {
      this.treeViews.delete(treeViewId);
      treeView.dispose();
    });
  }

  createTreeView<T>(treeViewId: string, options: TreeViewOptions<T>): TreeView<T> {
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
   * @param treeItemId
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
}

class ExtHostTreeView<T> implements IDisposable {
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

  private _visible = false;

  private selectedItemIds = new Set<string>();

  private id2Element: Map<string, T> = new Map<string, T>();
  private element2TreeViewItem: Map<T, TreeViewItem> = new Map<T, TreeViewItem>();
  private element2VSCodeTreeItem: Map<T, vscode.TreeItem> = new Map<T, vscode.TreeItem>();

  private disposable: DisposableStore = new DisposableStore();

  private treeDataProvider: vscode.TreeDataProvider<T>;
  private _onDidChangeData: Emitter<TreeData<T>> = new Emitter<TreeData<T>>();

  private _title: string;
  private _description: string;
  private _message: string;

  private roots: TreeViewItem[] | undefined = undefined;
  private nodes: Map<T, TreeViewItem[] | undefined> = new Map();

  private refreshPromise: Promise<void> = Promise.resolve();
  private refreshQueue: Promise<void> = Promise.resolve();

  private isFetchingChildren = false;
  constructor(
    private treeViewId: string,
    private options: TreeViewOptions<T>,
    private proxy: IMainThreadTreeView,
    private commands: ExtHostCommands,
  ) {
    this.treeDataProvider = this.options.treeDataProvider;

    this.disposable.add(this._onDidChangeData);
    // 将 options 直接取值，避免循环引用导致序列化异常
    proxy.$registerTreeDataProvider(treeViewId, {
      showCollapseAll: !!options.showCollapseAll,
      canSelectMany: !!options.canSelectMany,
    });

    if (this.treeDataProvider.onDidChangeTreeData) {
      const dispose = this.treeDataProvider.onDidChangeTreeData((itemToRefresh) => {
        if (this.isFetchingChildren) {
          // cause of https://github.com/opensumi/core/issues/723.
          return;
        }
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
            if (this.isFetchingChildren) {
              return result;
            }
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
    let elementId;
    this.id2Element.forEach((el, id) => {
      if (Object.is(el, element)) {
        elementId = id;
      }
    });

    if (elementId) {
      return this.proxy.$reveal(this.treeViewId, elementId, options);
    }
  }

  getTreeItem(treeItemId?: string): T | undefined {
    if (treeItemId) {
      return this.id2Element.get(treeItemId);
    }
  }

  /**
   * 在节点被点击或者打开时，获取原有的 command 为 undefined 时被调用
   * 在节点被 Hover 时，获取原有的 tooltip 为 undefined 时被调用
   */
  async resolveTreeItem(treeItemId: string, token: CancellationToken): Promise<TreeViewItem | undefined> {
    if (!this.treeDataProvider.resolveTreeItem) {
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
      const resolve = (await this.treeDataProvider.resolveTreeItem(node, cache, token)) ?? node;
      node.tooltip = resolve.tooltip;
      node.command = resolve.command;
      return this.toTreeViewItem(node);
    }
    return;
  }

  async getChildren(treeItemId?: string): Promise<TreeViewItem[] | undefined> {
    // 缓存中获取节点
    const cachedElement = this.getTreeItem(treeItemId);
    // 如果存在缓存数据，优先从缓存中获取子节点
    if (!cachedElement && this.roots) {
      return this.roots;
    } else if (cachedElement) {
      const cache = this.nodes.get(cachedElement);
      if (cache) {
        return cache;
      }
    }
    let children: TreeViewItem[] | undefined;
    this.isFetchingChildren = true;
    const results = await this.treeDataProvider.getChildren(cachedElement);
    this.isFetchingChildren = false;
    if (this._refreshCancellationSource.token.isCancellationRequested) {
      children = undefined;
    } else {
      if (results) {
        const treeItems: TreeViewItem[] = [];
        for (const [index, value] of results.entries()) {
          // 遍历treeDataProvider获取的值生成节点
          const treeItem = await this.treeDataProvider.getTreeItem(value);
          if (this._refreshCancellationSource.token.isCancellationRequested) {
            return;
          }
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
          // 生成ID用于存储缓存
          const id =
            treeItem.id || `${treeItemId || 'root'}/${index}:${typeof label === 'string' ? label : label?.label}`;
          this.id2Element.set(id, value);

          const treeViewItem = this.toTreeViewItem(treeItem, {
            id,
          });
          this.element2TreeViewItem.set(value, treeViewItem);
          this.element2VSCodeTreeItem.set(value, treeItem);
          treeItems.push(treeViewItem);
        }

        if (this._refreshCancellationSource.token.isCancellationRequested) {
          children = undefined;
        } else {
          children = treeItems;
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
    } else if (iconPath instanceof ThemeIcon) {
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
      !(extensionTreeItem.iconPath instanceof ThemeIcon) &&
      (extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark
    ) {
      return this.getIconPath((extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark);
    }
    return undefined;
  }

  private getLightIconPath(extensionTreeItem: vscode.TreeItem): string | undefined {
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof ThemeIcon)) {
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
