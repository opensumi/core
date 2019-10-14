import { Injectable, Autowired } from '@ali/common-di';
import { DebugConsoleSession } from '../console/debug-console-session';
import { observable, action } from 'mobx';
import { TreeNode } from '@ali/ide-core-browser';

@Injectable()
export class DebugStackFramesService {
  @Autowired(DebugConsoleSession)
  protected readonly debugConsole: DebugConsoleSession;

  constructor() {
    this.debugConsole.onDidChange(() => {
      this.currentItems = this.debugConsole.getChildren();
      this.updateNodes(this.currentItems);
    });
  }

  private currentItems: any[];

  @observable.shallow
  status: Map<string | number, {
    expanded?: boolean;
    selected?: boolean;
    depth: number;
    node: any;
    [key: string]: any;
  }> = new Map();

  @observable.shallow
  nodes: TreeNode[] = [];

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

  @action
  initNodes(nodes: any[], depth: number) {
    this.nodes = this.extractNodes(nodes, depth);
  }

  @action
  resetStatus() {
    this.status.clear();
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

  execute = (value: string) => {
    this.debugConsole.execute(value);
  }
}
