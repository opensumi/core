import { Injectable, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugViewModel } from './debug-view-model';
import { TreeNode } from '@ali/ide-core-browser';
import { DebugScope } from '../console/debug-console-items';

@Injectable()
export class DebugVariableService {
  @observable
  scopes: DebugScope[] = [];

  @observable.shallow
  status: Map<string | number, {
    expanded?: boolean;
    selected?: boolean;
    depth: number;
    scope: DebugScope;
    [key: string]: any;
  }> = new Map();

  @observable.shallow
  nodes: TreeNode[] = [];

  @Autowired(DebugViewModel)
  protected readonly viewModel: DebugViewModel;

  constructor() {
    this.init();
  }

  init() {
    this.viewModel.onDidChange(async () => {
      await this.updateScopes();
    });
  }

  @action.bound
  async onSelect(nodes: TreeNode[]) {
    const node = nodes[0];
    const status = this.status.get(node.id);
    if (status) {
      if (typeof status.expanded !== 'undefined') {
        this.status.set(node.id, {
          ...status,
          expanded: !status.expanded,
          selected: true,
        });
        if (!status.expanded && status.scope.children.length === 0) {
          await status.scope.getChildren();
        }
        this.nodes = this.extractNodes(this.scopes, 0);
      } else {
        this.status.set(node.id, {
          ...status,
          selected: true,
        });
      }
    }
  }

  extractNodes(scopes: any[], depth: number, order: number = 0): TreeNode[] {
    let nodes: TreeNode[] = [];
    this.updateStatus(scopes, depth);
    scopes.forEach((scope, index) => {
      order = order + index + 1;
      if (!scope.hasChildren) {
        nodes.push({
          id: scope.id,
          name: scope.name,
          tooltip: scope.tooltip,
          description: scope.description,
          descriptionClass: scope.descriptionClass,
          labelClass: scope.labelClass,
          afterLabel: scope.afterLabel,
          children: scope.children,
          order,
          depth,
          parent: scope.parent,
        });
      } else {
        const status = this.status.get(scope.id);
        if (status) {
          nodes.push({
            id: scope.id,
            order,
            name: scope.name,
            tooltip: scope.tooltip,
            description: scope.description,
            descriptionClass: scope.descriptionClass,
            labelClass: scope.labelClass,
            afterLabel: scope.afterLabel,
            children: scope.children,
            depth,
            parent: scope.parent,
            expanded: status && status.expanded ? status.expanded : false,
          } as TreeNode);
          if (status.expanded) {
            const childs = this.extractNodes(scope.children, depth + 1, order + 1);
            nodes = nodes.concat(childs);
          }
        }
      }
    });
    return nodes;
  }

  @action
  async updateScopes() {
    const { currentSession } = this.viewModel;
    this.scopes = currentSession ? await currentSession.getScopes() : [];
    this.resetStatus();
    this.initNodes(this.scopes, 0);
  }

  @action
  initNodes(scopes: any[], depth: number) {
    this.nodes = this.extractNodes(scopes, 0, depth);
  }

  @action
  resetStatus() {
    this.status.clear();
  }

  @action
  updateStatus(scopes: any[], depth: number = 0) {
    scopes.forEach((scope) => {
      if (!this.status.has(scope.id) && scope) {
        this.status.set(scope.id, {
          expanded: false,
          selected: false,
          depth,
          scope,
        });
      }
    });
  }

}
