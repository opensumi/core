import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import {
  OpenedEditorTreeDataProvider,
  EditorGroupTreeItem,
  OpenedResourceTreeItem,
  IOpenEditorStatus,
} from './opened-editor.service';
import { IResource } from '@ali/ide-editor';
import { EDITOR_COMMANDS, CommandService, localize, URI, Emitter, Event, FileDecorationsProvider, IFileDecoration, Uri } from '@ali/ide-core-browser';
import { TreeViewActionTypes, TreeViewAction, TreeNode } from '@ali/ide-core-browser/lib/components';
import { IWorkspaceService } from '@ali/ide-workspace';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';

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

  actions: TreeViewAction[] = [
    {
      icon: getIcon('close'),
      title: localize('file.close'),
      command: EDITOR_COMMANDS.CLOSE.id,
      location: TreeViewActionTypes.TreeNode_Left,
      paramsKey: 'uri',
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
    this.openEditorTreeDataProvider.onDidChangeTreeData(async (element) => {
      await this.getTreeDatas();
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
          if (this.status[statusKey]) {
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
  resetFocused() {
    this.nodes = this.nodes.map((node) => {
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
    return node.parent && node.parent.name + node.uri.toString();
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
}
