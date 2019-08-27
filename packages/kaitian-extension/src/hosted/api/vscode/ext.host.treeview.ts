import { IExtHostTreeView, IMainThreadTreeView, IExtHostCommands, MainThreadAPIIdentifier } from '../../../common/vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { TreeView, TreeViewItem, TreeViewSelection, TreeViewOptions } from '../../../common/vscode';
import { IDisposable, Emitter, Disposable } from '@ali/ide-core-common';
import * as vscode from 'vscode';

export class ExtHostTreeViews implements IExtHostTreeView {
  private proxy: IMainThreadTreeView;

  private treeViews: Map<string, ExtHostTreeView<any>> = new Map<string, ExtHostTreeView<any>>();

  constructor(rpc: IRPCProtocol, extHostCommand: IExtHostCommands) {
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

    const treeView = new ExtHostTreeView(treeViewId, options.treeDataProvider, this.proxy);
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

      reveal: (element: T, selectionOptions: { select?: boolean }): Thenable<void> =>
        treeView.reveal(element, selectionOptions),

      dispose: () => {
        this.treeViews.delete(treeViewId);
        treeView.dispose();
      },
    };
  }

  async $getChildren(treeViewId: string, treeItemId?: string): Promise<TreeViewItem[] | undefined> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id' + treeViewId);
    }

    return treeView.getChildren(treeItemId);
  }

  async $setExpanded(treeViewId: string, treeItemId: string, expanded: boolean): Promise<any> {
    const treeView = this.treeViews.get(treeViewId);
    if (!treeView) {
      throw new Error('No tree view with id' + treeViewId);
    }

    if (expanded) {
      return treeView.onExpanded(treeItemId);
    } else {
      return treeView.onCollapsed(treeItemId);
    }
  }
}

class ExtHostTreeView<T> implements IDisposable {

  private onDidExpandElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<vscode.TreeViewExpansionEvent<T>>();
  public readonly onDidExpandElement = this.onDidExpandElementEmitter.event;

  private onDidCollapseElementEmitter: Emitter<vscode.TreeViewExpansionEvent<T>> = new Emitter<vscode.TreeViewExpansionEvent<T>>();
  public readonly onDidCollapseElement = this.onDidCollapseElementEmitter.event;

  private selection: T[] = [];
  get selectedElements(): T[] { return this.selection; }

  private cache: Map<string, T> = new Map<string, T>();

  private idCounter: number = 0;

  constructor(
    private treeViewId: string,
    private treeDataProvider: vscode.TreeDataProvider<T>,
    private proxy: IMainThreadTreeView) {
    proxy.$registerTreeDataProvider(treeViewId);

    if (treeDataProvider.onDidChangeTreeData) {
      treeDataProvider.onDidChangeTreeData(() => {
        proxy.$refresh(treeViewId);
      });
    }
  }

  dispose() {
  }

  async reveal(element: T, selectionOptions?: { select?: boolean }): Promise<void> {
    // 在缓存中查找对应节点
    let elementId;
    this.cache.forEach((el, id) => {
      if (Object.is(el, element)) {
        elementId = id;
      }
    });

    if (elementId) {
      return this.proxy.$reveal(this.treeViewId, elementId);
    }
  }

  generateId(): string {
    return `item-${this.idCounter++}`;
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
      const promises = result.map(async (value) => {

        // 遍历treeDataProvider获取的值生成节点
        const treeItem = await this.treeDataProvider.getTreeItem(value);

        // 生成临时ID用于存储缓存
        const id = this.generateId();

        this.cache.set(id, value);

        // 获取Label属性用于
        let label = treeItem.label;

        // 当没有指定label时尝试使用resourceUri
        if (!label && treeItem.resourceUri) {
          label = treeItem.resourceUri.path.toString();
          label = decodeURIComponent(label);
          if (label.indexOf('/') >= 0) {
            label = label.substring(label.lastIndexOf('/') + 1);
          }
        }

        // 使用ID作为label
        if (!label) {
          label = id;
        }

        const { iconPath } = treeItem;
        const treeViewItem = {
          id,
          label,
          icon: '',
          iconUrl: iconPath,
          themeIconId: 'file',
          resourceUri: treeItem.resourceUri,
          tooltip: treeItem.tooltip,
          collapsibleState: treeItem.collapsibleState,
          contextValue: treeItem.contextValue,
          command: treeItem.command,
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

}
