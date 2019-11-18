import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import {
  OpenedEditorTreeDataProvider,
  EditorGroupTreeItem,
  OpenedResourceTreeItem,
  IOpenEditorStatus,
} from './opened-editor.service';
import { IResource, IResourceDecorationChangeEventPayload, IEditorGroup } from '@ali/ide-editor';
import { EDITOR_COMMANDS, CommandService, localize, URI, Emitter, Event, FileDecorationsProvider, IFileDecoration, Uri, TreeViewActionConfig } from '@ali/ide-core-browser';
import { TreeViewActionTypes, TreeNode } from '@ali/ide-core-browser/lib/components';
import { IWorkspaceService } from '@ali/ide-workspace';
import { getIcon } from '@ali/ide-core-browser';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';
import * as styles from './index.module.less';
import { OPEN_EDITORS_COMMANDS } from './opened-editor.contribution';

@Injectable()
export class ExplorerOpenedEditorService {
  @Autowired(OpenedEditorTreeDataProvider)
  openEditorTreeDataProvider: OpenedEditorTreeDataProvider;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IDecorationsService)
  decorationsService: IDecorationsService;

  @Autowired(IThemeService)
  themeService: IThemeService;

  @observable.shallow
  nodes: any[] = [];

  @observable.shallow
  status: IOpenEditorStatus = {};

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

  constructor() {
    this.init();
  }

  async init() {
    await this.getTreeDatas();
    this.openEditorTreeDataProvider.onDidChange(async (element) => {
      await this.getTreeDatas();
    });
    this.openEditorTreeDataProvider.onDidDecorationChange(async (payload) => {
      if (payload) {
        await this.updateDecorations(payload);
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
      const treeitem = this.openEditorTreeDataProvider.getTreeItem(element, roots);
      if (treeitem instanceof EditorGroupTreeItem) {
        const editorGroupTreeItem = treeitem as EditorGroupTreeItem;
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
          let node: TreeNode = {
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
          if (this.status[statusKey]) {
            if (this.status[statusKey].dirty) {
              node  = {
                ...node,
                headClass: styles.dirty_icon,
              };
            }
            treeData.push({
              ...node,
              ...this.status[statusKey],
            });
          } else {
            treeData.push(node);
          }
        });
      } else if (treeitem instanceof OpenedResourceTreeItem) {
        const openedResourceTreeItem = treeitem as OpenedResourceTreeItem;
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
        if (this.status[statusKey]) {
          treeData.push({
            ...node,
            ...this.status[statusKey],
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
        this.status[statusKey] = {
          ...this.status[statusKey],
          dirty: payload.decoration.dirty,
        };
        return {
          ...node,
          headClass: payload.decoration.dirty ? styles.dirty_icon : '',
        };
      }
      return node;
    });
  }

  @action
  resetFocused() {
    this.nodes = this.nodes.map((node) => {
      const statusKey = this.getStatusKey(node);
      this.status[statusKey] = {
        ...this.status[statusKey],
        focused: false,
      };
      return {
        ...node,
        focused: false,
      };
    });
  }

  @action
  resetStatus() {
    for (const key of Object.keys(this.status)) {
      this.status[key] = {
        ... this.status[key],
        focused: false,
        selected: false,
      };
    }
  }

  @action
  updateStatus(node: TreeNode) {
    this.resetStatus();
    const statuskey = this.getStatusKey(node);
    this.status[statuskey] = {
      ... this.status[statuskey],
      focused: true,
      selected: true,
    } ;
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
    this.updateStatus(node);
    this.nodes = this.nodes.map((node) => {
      const statusKey = this.getStatusKey(node);
      if (this.status[statusKey]) {
        return {
          ...node,
          ...this.status[statusKey],
        };
      } else {
        return node;
      }
    });
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, node.uri);
  }

  getStatusKey(node) {
    return node.parent ? node.parent.name + node.uri.toString() : node.uri.toString();
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
}
