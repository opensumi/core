import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { IDisposable, Emitter, Disposable, Uri, DisposableStore, toDisposable } from '@opensumi/ide-core-common';
import type { CancellationToken } from '@opensumi/ide-core-common/lib/cancellation';

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

  private cache: Map<string, T> = new Map<string, T>();
  private cacheTreeItems: Map<T, vscode.TreeItem> = new Map<T, vscode.TreeItem>();

  private disposable: DisposableStore = new DisposableStore();

  private treeDataProvider: vscode.TreeDataProvider<T>;

  private _title: string;
  private _description: string;
  private _message: string;

  constructor(
    private treeViewId: string,
    private options: TreeViewOptions<T>,
    private proxy: IMainThreadTreeView,
    private commands: ExtHostCommands,
  ) {
    this.treeDataProvider = this.options.treeDataProvider;

    // 将 options 直接取值，避免循环引用导致序列化异常
    proxy.$registerTreeDataProvider(treeViewId, {
      showCollapseAll: !!options.showCollapseAll,
      canSelectMany: !!options.canSelectMany,
    });

    if (this.treeDataProvider.onDidChangeTreeData) {
      const dispose = this.treeDataProvider.onDidChangeTreeData((itemToRefresh) => {
        proxy.$refresh<T>(treeViewId);
      });
      if (dispose) {
        this.disposable.add(dispose);
      }
    }

    this.disposable.add(toDisposable(() => this.cache.clear()));
    this.disposable.add(toDisposable(() => proxy.$unregisterTreeDataProvider(treeViewId)));
  }

  dispose() {
    this.disposable.dispose();
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
    this.proxy.$setMessage(this.treeViewId, value);
    this._message = value;
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
    this.cache.forEach((el, id) => {
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
      return this.cache.get(treeItemId);
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
    const cache = this.getTreeItem(treeItemId);
    if (cache) {
      const node = this.cacheTreeItems.get(cache);

      if (node) {
        const resolve = (await this.treeDataProvider.resolveTreeItem(node!, cache, token)) ?? node;
        node.tooltip = resolve.tooltip;
        node.command = resolve.command;
        return this.toTreeViewItem(node);
      }
    }
    return;
  }

  async getChildren(treeItemId?: string): Promise<TreeViewItem[] | undefined> {
    // 缓存中获取节点
    const cachedElement = this.getTreeItem(treeItemId);

    // 从treeDataProvider中查询子节点存放于缓存中
    const result = await this.treeDataProvider.getChildren(cachedElement);
    if (result) {
      const treeItems: TreeViewItem[] = [];
      const promises = result.map(async (value, index) => {
        // 遍历treeDataProvider获取的值生成节点
        const treeItem = await this.treeDataProvider.getTreeItem(value);
        this.cacheTreeItems.set(value, treeItem);

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
        this.cache.set(id, value);

        const treeViewItem = this.toTreeViewItem(treeItem, {
          id,
        });
        treeItems.push(treeViewItem);
      });

      await Promise.all(promises);
      return treeItems;
    } else {
      return undefined;
    }
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
