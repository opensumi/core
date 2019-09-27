import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import {
  OpenedEditorTreeDataProvider,
  EditorGroupTreeItem,
  OpenedResourceTreeItem,
  IOpenEditorStatus,
} from './opened-editor.service';
import { IResource } from '@ali/ide-editor';
import { EDITOR_COMMANDS, CommandService, localize, URI } from '@ali/ide-core-browser';
import { TreeViewActionTypes, TreeViewAction, TreeNode } from '@ali/ide-core-browser/lib/components';
import { IWorkspaceService } from '@ali/ide-workspace';
import { getIcon } from '@ali/ide-theme/lib/browser';

@Injectable()
export class ExplorerOpenedEditorService {
  @Autowired(OpenedEditorTreeDataProvider)
  openEditorTreeDataProvider: OpenedEditorTreeDataProvider;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(CommandService)
  commandService: CommandService;

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

  constructor() {
    this.init();
  }

  async init() {
    await this.getTreeDatas();
    this.openEditorTreeDataProvider.onDidChangeTreeData(async (element) => {
      await this.getTreeDatas();
    });
  }

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
        treeData.push({
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
        });
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
            parent: child.parent,
          };
          const uri = child.uri.toString();
          if (this.status[uri]) {
            treeData.push({
              ...node,
              ...this.status[uri],
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
          parent: openedResourceTreeItem.parent,
        };
        const uri = openedResourceTreeItem.uri.toString();
        if (this.status[uri]) {
          treeData.push({
            ...node,
            ...this.status[uri],
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
  updateStatus(uri: string) {
    this.resetStatus();
    this.status[uri] = {
      focused: true,
      selected: true,
    };
  }

  /**
   * 打开文件
   * @param node
   */
  @action.bound
  openFile(node) {
    let uri;
    if (Array.isArray(node)) {
      uri = node[0] && node[0].uri;
    } else {
      uri = node.uri;
    }
    this.updateStatus(uri);
    this.nodes = this.nodes.map((node) => {
      if (this.status[node.uri.toString()]) {
        return {
          ...node,
          ...this.status[node.uri.toString()],
        };
      } else {
        return node;
      }
    });
    this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, uri);
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
    this.commandService.executeCommand(commandId, params);
  }
}
