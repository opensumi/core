import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { observable, action } from 'mobx';
import { TreeNode } from '@ali/ide-core-browser';
import { DebugViewModel } from './debug-view-model';
import { DebugWatch } from '../model';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { WorkspaceStorageService } from '@ali/ide-workspace/lib/browser/workspace-storage-service';

@Injectable()
export class DebugWatchService {

  @Autowired(DebugViewModel)
  protected readonly model: DebugViewModel;

  @Autowired(DebugWatch)
  protected readonly debugWatch: DebugWatch;

  @Autowired(WorkspaceStorageService)
  protected readonly storage: WorkspaceStorageService;

  @observable.shallow
  status: Map<string | number, {
    expanded?: boolean;
    selected?: boolean;
    depth: number;
    node: TreeNode;
    [key: string]: any;
  }> = new Map();

  @observable.shallow
  nodes: TreeNode[] = [];

  private currentItems: any[];

  constructor() {
    this.init();
  }

  async init() {
    this.load();
    this.debugWatch.onDidChange(async () => {
      this.currentItems = await this.debugWatch.getChildren();
      this.updateNodes(this.currentItems);
    });
  }

  extractNodes(items: any[], depth: number): TreeNode[] {
    let nodes: TreeNode[] = [];
    this.updateStatus(items, depth);
    items.forEach((item, index) => {
      if (!item.hasChildren) {
        nodes.push({
          id: item.id,
          name: item.name,
          title: item.title,
          tooltip: item.tooltip,
          description: item.description,
          descriptionClass: item.descriptionClass,
          labelClass: item.labelClass,
          afterLabel: item.afterLabel,
          children: item.children,
          depth,
          parent: item.parent,
        });
      } else {
        const status = this.status.get(item.id);
        if (status) {
          nodes.push({
            id: item.id,
            name: item.name,
            title: item.title,
            tooltip: item.tooltip,
            description: item.description,
            descriptionClass: item.descriptionClass,
            labelClass: item.labelClass,
            afterLabel: item.afterLabel,
            children: item.children,
            depth,
            parent: item.parent,
            expanded: status && typeof status.expanded === 'boolean' ? status.expanded : false,
          } as TreeNode);
          if (status.expanded) {
            const childs = this.extractNodes(item.children, depth + 1);
            nodes = nodes.concat(childs);
          }
        }
      }
    });
    return nodes;
  }

  async updateNodes(nodes: any[]) {
    this.resetStatus();
    this.initNodes(nodes, 0);
  }

  @action
  resetStatus() {
    this.status.clear();
  }

  @action
  initNodes(nodes: any[], depth: number) {
    this.nodes = this.extractNodes(nodes, depth);
  }

  @action
  updateStatus(nodes: any[], depth: number = 0) {
    nodes.forEach((node) => {
      if (!this.status.has(node.id) && node) {
        this.status.set(node.id, {
          expanded: false,
          selected: false,
          depth,
          node,
        });
      }
    });
  }

  @action.bound
  async onSelect(nodes: TreeNode[], event) {
    const node = nodes[0];
    if (!node) {
      return ;
    }
    const status = this.status.get(node.id);
    if (status) {
      if (typeof status.expanded !== 'undefined') {
        this.status.set(node.id, {
          ...status,
          expanded: !status.expanded,
          selected: true,
        });
        if (!status.expanded && status.node.children.length === 0) {
          await status.node.getChildren();
        }
        this.nodes = this.extractNodes(this.currentItems, 0);
      } else {
        this.status.set(node.id, {
          ...status,
          selected: true,
        });
      }
    }
  }

  @action.bound
  onChange(node: TreeNode, value?: string) {
    this.clearTemporaryNode();
    if (value) {
      this.execute(value);
    }
  }

  clearTemporaryNode() {
    this.nodes =  this.nodes.filter((node) => !node.isTemporary);
  }

  execute(value: string) {
    this.debugWatch.execute(value);
  }

  addWatchHandler() {
    this.nodes = [this.createEditableNode()].concat(this.nodes);
  }

  createEditableNode() {
    return {
      name: TEMP_FILE_NAME,
      id: TEMP_FILE_NAME,
      isTemporary: true,
    } as TreeNode;
  }

  @action
  removeAll() {
    this.nodes = [];
    this.debugWatch.clear();
    this.clearStorage();
  }

  clearStorage() {
    this.storage.setData('debug.watchers.list', []);
  }

  @action
  collapseAll() {
    for (const [key, value] of this.status ) {
      this.status.set(key, {
        ...value,
        expanded: false,
      });
    }
    this.nodes = this.extractNodes(this.currentItems, 0);
  }

  async load() {
    const data = await this.storage.getData<string[]>('debug.watchers.list', []);
    if (data) {
      for (const value of data) {
        this.execute(value);
      }
    }
  }

  save(): void {
    const data: string[] = [];
    for (const node of this.nodes) {
      // 只保留父节点
      if (!node.parent) {
        data.push(node.name as string);
      }
    }
    this.storage.setData('debug.watchers.list', data);
  }
}
