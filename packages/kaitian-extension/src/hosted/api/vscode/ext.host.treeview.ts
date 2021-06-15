import { IExtHostTreeView, IMainThreadTreeView, ITreeViewRevealOptions, MainThreadAPIIdentifier } from '../../../common/vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { TreeView, TreeViewItem, TreeViewSelection, TreeViewOptions } from '../../../common/vscode';
import { IDisposable, Emitter, Disposable, Uri, DisposableStore, toDisposable } from '@ali/ide-core-common';
import type * as vscode from 'vscode';
import { ThemeIcon } from '../../../common/vscode/ext-types';
import { isUndefined } from 'util';
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

    const treeView = new ExtHostTreeView(
      treeViewId,
      options,
      this.proxy,
      this.extHostCommand,
    );
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

  private onDidExpandElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<vscode.TreeViewExpansionEvent<T>>();
  public readonly onDidExpandElement = this.onDidExpandElementEmitter.event;

  private onDidCollapseElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<vscode.TreeViewExpansionEvent<T>>();
  public readonly onDidCollapseElement = this.onDidCollapseElementEmitter.event;

  private readonly onDidChangeSelectionEmitter = new Emitter<vscode.TreeViewSelectionChangeEvent<T>>();
  readonly onDidChangeSelection = this.onDidChangeSelectionEmitter.event;

  private readonly onDidChangeVisibilityEmitter = new Emitter<vscode.TreeViewVisibilityChangeEvent>();
  readonly onDidChangeVisibility = this.onDidChangeVisibilityEmitter.event;

  private _visible = false;

  private selectedItemIds = new Set<string>();

  private cache: Map<string, T> = new Map<string, T>();

  private disposable: DisposableStore = new DisposableStore();

  private treeDataProvider: vscode.TreeDataProvider<T>;

  constructor(
    private treeViewId: string,
    private options: TreeViewOptions<T>,
    private proxy: IMainThreadTreeView,
    private commands: ExtHostCommands,
  ) {

    this.treeDataProvider = this.options.treeDataProvider;

    // 将 options 直接取值，避免循环引用导致序列化异常
    proxy.$registerTreeDataProvider(
      treeViewId,
      {
        showCollapseAll: !!options.showCollapseAll,
        canSelectMany: !!options.canSelectMany,
      },
    );

    if (this.treeDataProvider.onDidChangeTreeData) {

      const dispose = this.treeDataProvider.onDidChangeTreeData((itemToRefresh) => {
        // TODO: 处理单独的Item刷新
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

  get visible(): boolean {
    return this._visible;
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

        // 获取Label属性
        let label: string | undefined;
        const treeItemLabel: string | vscode.TreeItemLabel | undefined = treeItem.label;
        if (typeof treeItemLabel === 'object' && typeof (treeItemLabel as vscode.TreeItemLabel).label === 'string') {
          label = (treeItemLabel as vscode.TreeItemLabel).label;
        } else {
          label = treeItem.label;
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
        const id = treeItem.id || `${treeItemId || 'root'}/${index}:${label}`;

        this.cache.set(id, value);

        // 使用ID作为label
        if (isUndefined(label)) {
          label = id;
        }

        const { iconPath } = treeItem;
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
        } as TreeViewItem;

        treeItems.push(treeViewItem);
      });

      await Promise.all(promises);
      return treeItems;
    } else {
      return undefined;
    }
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
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof ThemeIcon) && (extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark) {
      return this.getIconPath((extensionTreeItem.iconPath as { light: string | Uri; dark: string | Uri }).dark);
    }
    return undefined;
  }

  private getLightIconPath(extensionTreeItem: vscode.TreeItem): string | undefined {
    if (extensionTreeItem.iconPath && !(extensionTreeItem.iconPath instanceof ThemeIcon)) {
      if (typeof extensionTreeItem.iconPath === 'string'
        || Uri.isUri(extensionTreeItem.iconPath)) {
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

  setSelection(selectedItemIds: string[]): void {
    this.doSetSelection(selectedItemIds);
  }

  protected doSetSelection(selectedItemIts: string[]): void {
    this.selectedItemIds = new Set(selectedItemIts);
    this.onDidChangeSelectionEmitter.fire(Object.freeze({ selection: this.selectedElements }));
  }
}
