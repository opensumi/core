import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { IResource, IResourceDecorationChangeEventPayload, IEditorGroup, WorkbenchEditorService } from '@ali/ide-editor';
import { EDITOR_COMMANDS, CommandService, localize, URI, Emitter, Event, FileDecorationsProvider, IFileDecoration, Uri, TreeViewActionConfig, memoize, OPEN_EDITORS_COMMANDS } from '@ali/ide-core-browser';
import { TreeViewActionTypes, TreeNode } from '@ali/ide-core-browser/lib/components';
import { IWorkspaceService } from '@ali/ide-workspace';
import { getIcon } from '@ali/ide-core-browser';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IContextMenu, AbstractContextMenuService, MenuId, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';

import {
  OpenedEditorTreeDataProvider,
  EditorGroupTreeItem,
  OpenedResourceTreeItem,
} from './opened-editor.service';

import * as styles from './index.module.less';

export interface IOpenEditorStatus {
  focused?: boolean;
  selected?: boolean;
  dirty?: boolean;
}

@Injectable()
export class ExplorerOpenedEditorService {
  @Autowired(OpenedEditorTreeDataProvider)
  private readonly openEditorTreeDataProvider: OpenedEditorTreeDataProvider;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(AbstractContextMenuService)
  private readonly contextMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  private readonly ctxMenuRenderer: ICtxMenuRenderer;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(IDecorationsService)
  public decorationsService: IDecorationsService;

  @Autowired(IThemeService)
  public themeService: IThemeService;

  @observable.shallow
  nodes: any[] = [];

  @observable.shallow
  status: Map<string, IOpenEditorStatus> = new Map();

  actions: TreeViewActionConfig[] = [
    {
      icon: getIcon('close'),
      title: localize('file.close'),
      command: EDITOR_COMMANDS.CLOSE.id,
      location: TreeViewActionTypes.TreeNode_Left,
      paramsKey: 'uri',
    },
    {
      icon: getIcon('save-all'),
      title: localize('open.editors.save.byId'),
      command: OPEN_EDITORS_COMMANDS.SAVE_BY_GROUP_ID.id,
      location: TreeViewActionTypes.TreeContainer,
      paramsKey: 'id',
    },
    {
      icon: getIcon('clear'),
      title: localize('open.editors.close.byId'),
      command: OPEN_EDITORS_COMMANDS.CLOSE_BY_GROUP_ID.id,
      location: TreeViewActionTypes.TreeContainer,
      paramsKey: 'id',
    },
  ];

  private decorationChangeEmitter = new Emitter<any>();
  decorationChangeEvent: Event<any> = this.decorationChangeEmitter.event;

  private themeChangeEmitter = new Emitter<any>();
  themeChangeEvent: Event<any> = this.themeChangeEmitter.event;

  private activeGroup: string;
  private activeUri: URI;

  async init() {
    await this.getTreeDatas();
    this.setExplorerTarbarBadge();
    this.openEditorTreeDataProvider.onDidChange(async (element) => {
      await this.getTreeDatas();
      this.setExplorerTarbarBadge();
    });
    this.openEditorTreeDataProvider.onDidDecorationChange(async (payload) => {
      if (payload) {
        await this.updateDecorations(payload);
        this.setExplorerTarbarBadge();
      }
    });
    this.workbenchEditorService.onActiveResourceChange((payload) => {
      if (payload) {
        this.activeUri = payload.uri as URI;
      }
      if (this.activeUri) {
        this.updateSelected(this.activeUri, this.activeGroup);
        this.setExplorerTarbarBadge();
      }
    });
    this.openEditorTreeDataProvider.onDidActiveChange(async (payload) => {
      if (payload) {
        this.activeGroup = payload.group.name;
      }
    });
    // 初始化
    this.themeChangeEmitter.fire(this.themeService);
    this.decorationChangeEmitter.fire(this.decorationsService);
    // 监听变化
    this.themeService.onThemeChange(() => {
      this.themeChangeEmitter.fire(this.themeService);
    });
    this.decorationsService.onDidChangeDecorations(() => {
      this.decorationChangeEmitter.fire(this.decorationsService);
    });
  }

  public overrideFileDecorationService: FileDecorationsProvider = {
    getDecoration : (uri, hasChildren = false) => {
      // 转换URI为vscode.uri
      if (uri instanceof URI ) {
        uri = Uri.parse(uri.toString());
      }
      return this.decorationsService.getDecoration(uri, hasChildren) as IFileDecoration;
    },
  };

  @action
  async getTreeDatas() {
    const allTreeData = this.openEditorTreeDataProvider.getChildren();
    const treeData: TreeNode[] = [];
    const roots = await this.workspaceService.roots;
    allTreeData.forEach((element) => {
      const treeItem = this.openEditorTreeDataProvider.getTreeItem(element, roots);
      if (treeItem instanceof EditorGroupTreeItem) {
        const editorGroupTreeItem = treeItem as EditorGroupTreeItem;
        const children = editorGroupTreeItem.group.resources.map((resource: IResource) => {
          return this.openEditorTreeDataProvider.getTreeItem(resource, roots);
        });
        const parent = {
          id: editorGroupTreeItem.id,
          uri: new URI(),
          label: editorGroupTreeItem.label,
          iconClass: editorGroupTreeItem.icon,
          expanded: editorGroupTreeItem.expanded,
          depth: editorGroupTreeItem.depth,
          name: editorGroupTreeItem.name,
          order: editorGroupTreeItem.order,
          tooltip: editorGroupTreeItem.tooltip,
          parent: editorGroupTreeItem.parent,
          children,
        };
        treeData.push(parent);
        children.forEach((child: any) => {
          const node: TreeNode = {
            id: child.id,
            label: child.label,
            tooltip: child.tooltip,
            description: child.description,
            icon: child.icon,
            command: child.command,
            uri: child.uri,
            depth: child.depth,
            order: child.order,
            name: child.name,
            parent,
          };
          const statusKey = this.getStatusKey(node);
          if (this.status.has(statusKey)) {
            const status = this.status.get(statusKey)!;
            treeData.push({
              ...node,
              ...status,
              headIconClass: status.dirty ? styles.dirty_icon : '',
            });
          } else {
            treeData.push(node);
          }
        });
      } else if (treeItem instanceof OpenedResourceTreeItem) {
        const openedResourceTreeItem = treeItem as OpenedResourceTreeItem;
        const node: TreeNode = {
          id: openedResourceTreeItem.id,
          label: openedResourceTreeItem.label,
          tooltip: openedResourceTreeItem.tooltip,
          description: openedResourceTreeItem.description,
          icon: openedResourceTreeItem.icon,
          command: openedResourceTreeItem.command,
          uri: openedResourceTreeItem.uri,
          depth: openedResourceTreeItem.depth,
          order: openedResourceTreeItem.order,
          name: openedResourceTreeItem.name,
          parent: undefined,
        };
        const statusKey = this.getStatusKey(node);
        const status = this.status.get(statusKey);
        if (status) {
          treeData.push({
            ...node,
            ...status,
            headIconClass: status.dirty ? styles.dirty_icon : '',
          });
        } else {
          treeData.push(node);
        }
      }
    });
    this.nodes = treeData;
  }

  @action
  async updateDecorations(payload: IResourceDecorationChangeEventPayload) {
    this.nodes = this.nodes.map((node) => {
      const statusKey = this.getStatusKey(node);
      if (node.uri.toString() === payload.uri.toString()) {
        const status = {
          ...this.status.get(statusKey),
          dirty: payload.decoration.dirty,
        };
        this.status.set(statusKey, status);
        return {
          ...node,
          ...status,
          headIconClass: payload.decoration.dirty ? styles.dirty_icon : '',
        };
      }
      return node;
    });
  }

  @action
  resetFocused() {
    this.nodes = this.nodes.map((node) => {
      const statusKey = this.getStatusKey(node);
      this.status.set(statusKey, {
        ...this.status.get(statusKey),
        focused: false,
      });
      return {
        ...node,
        focused: false,
      };
    });
  }

  @action
  resetStatus() {
    for (const [key, value] of this.status) {
      this.status.set(key, {
        ...value,
        focused: false,
        selected: false,
      });
    }
  }

  @action
  updateSelected(uri: URI, group: string) {
    const statusKey = group + uri.toString();
    this.resetStatus();
    this.status.set(statusKey, {
      ... this.status.get(statusKey),
      focused: true,
      selected: true,
    });
    this.nodes = this.nodes.map((node) => {
      const statusKey = this.getStatusKey(node);
      const status = this.status.get(statusKey);
      if (status) {
        return {
          ...node,
          ...status,
          headIconClass: status.dirty ? styles.dirty_icon : '',
        };
      } else {
        return node;
      }
    });
  }

  @action
  updateStatus(node: TreeNode) {
    this.resetStatus();
    const statusKey = this.getStatusKey(node);
    this.status.set(statusKey, {
      ... this.status.get(statusKey),
      focused: true,
      selected: true,
    });
  }

  /**
   * 打开文件
   * @param node
   */
  @action.bound
  onSelect(nodes: TreeNode[]) {
    if (!nodes || nodes.length === 0) {
      this.resetStatus();
      return;
    }
    // 仅支持单选
    const node = nodes[0];
    const group: string = node.parent ? node.parent.label as string : '';
    const groupIndex: string = node.parent ? node.parent.id as string : '';
    this.activeGroup = group;
    this.updateSelected(node.uri!, group);
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri, { groupIndex });
  }

  /**
   * 右键菜单
   * @param node
   */
  @action.bound
  onContextMenu(nodes: TreeNode[], event: React.MouseEvent<HTMLElement>) {
    const { x, y } = event.nativeEvent;
    // 仅支持单选
    const node = nodes[0];
    const group: string = node.parent ? node.parent.label as string : '';
    this.updateSelected(node.uri!, group);

    const menus = this.contributedContextMenu;
    const menuNodes = menus.getMergedMenuNodes();
    this.ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes,
      args: [ node.uri ],
    });
  }

  @memoize get contributedContextMenu(): IContextMenu {
    return this.contextMenuService.createMenu({
      id: MenuId.OpenEditorsContext,
    });
  }

  getStatusKey(node) {
    return node.parent ? node.parent.label + node.uri.toString() : this.activeGroup + node.uri.toString();
  }

  /**
   * 关闭文件
   * @param node
   */
  @action.bound
  closeFile(node) {
    let uri;
    if (Array.isArray(node)) {
      uri = node[0] && node[0].uri;
    } else {
      uri = node.uri;
    }
    this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id, uri);
  }

  clearStatus() {
    this.status.clear();
  }

  commandActuator = (commandId: string, params: any) => {
    return this.commandService.executeCommand(commandId, params);
  }

  async closeByGroupId(id: number) {
    const groups = this.openEditorTreeDataProvider.getChildren();
    const group = groups[id] as IEditorGroup;
    if (group) {
      group.closeAll();
    }
  }

  saveByGroupId(id: number) {
    const groups = this.openEditorTreeDataProvider.getChildren();
    const group = groups[id] as IEditorGroup;
    if (group) {
      group.saveAll();
    }
  }

  private setExplorerTarbarBadge() {
    const dirtyCount = this.nodes.filter((node) => !!node.dirty).length;
    const handler = this.layoutService.getTabbarHandler(ExplorerContainerId);
    if (handler) {
      handler.setBadge(dirtyCount > 0 ? dirtyCount.toString() : '');
    }
  }
}
