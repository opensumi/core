import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugHoverSource, ExpressionVariable } from './debug-hover-source';
import { ExpressionItem, DebugVariable } from '../console/debug-console-items';
import { TreeNode } from '@ali/ide-core-browser';

@Injectable()
export class DebugHoverService {

  @Autowired(DebugHoverSource)
  protected readonly hoverSource: DebugHoverSource;

  @observable
  value: string;

  @observable.shallow
  elements: (DebugVariable | ExpressionItem )[] = [];

  @observable.shallow
  nodes: TreeNode[] = [];

  @observable.shallow
  status: Map<string | number, {
    expanded?: boolean;
    selected?: boolean;
    depth: number;
    element: DebugVariable | ExpressionItem;
    [key: string]: any;
  }> = new Map();

  constructor() {
    if (this.hoverSource.expression) {
      this.value = this.hoverSource.expression.value;
    }
    this.hoverSource.onDidChange((expression) => {
      this.updateExpression(expression);
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
        if (!status.expanded && status.element.children.length === 0) {
          await status.element.getChildren();
        }
        this.nodes = this.extractNodes(this.elements, 0);
      } else {
        this.status.set(node.id, {
          ...status,
          selected: true,
        });
      }
    }
  }

  extractNodes(elements: (DebugVariable | ExpressionItem )[], depth: number, step: number = 0): TreeNode[] {
    let nodes: TreeNode[] = [];
    this.updateStatus(elements, depth);
    elements.forEach((element, index) => {
      if (element instanceof DebugVariable) {
        if (!element.hasChildren) {
          nodes.push({
            id: element.id,
            name: element.name,
            tooltip: element.tooltip,
            description: element.description,
            descriptionClass: element.descriptionClass,
            labelClass: element.labelClass,
            afterLabel: element.afterLabel,
            children: element.children,
            order: step + index,
            depth,
            parent: element.parent,
          });
        } else {
          const status = this.status.get(element.id);
          if (status) {
            nodes.push({
              id: element.id,
              order: step + index,
              name: element.name,
              tooltip: element.tooltip,
              description: element.description,
              descriptionClass: element.descriptionClass,
              labelClass: element.labelClass,
              afterLabel: element.afterLabel,
              children: element.children,
              depth,
              parent: element.parent,
              expanded: status && status.expanded ? status.expanded : false,
            } as TreeNode);
            if (status.expanded) {
              const childs =  this.extractNodes(element.children, depth + 1, step + index + 1);
              nodes = nodes.concat(childs);
            }
          }
        }
      }
    });
    return nodes;
  }

  @action
  async updateExpression(expression: ExpressionVariable ) {
    if (expression) {
      this.value = expression.value;
      this.elements = await expression.getChildren() as (DebugVariable | ExpressionItem )[];
      this.resetStatus();
      this.initNodes(this.elements, 0);
    }
  }

  @action
  initNodes(elements: (DebugVariable | ExpressionItem )[], depth: number) {
    this.nodes = this.extractNodes(elements, 0, depth);
  }

  @action
  resetStatus() {
    this.status.clear();
  }

  @action
  updateStatus(elements: (DebugVariable | ExpressionItem )[], depth: number = 0) {
    elements.forEach((element) => {
      if (!this.status.has(element.id) && element instanceof DebugVariable) {
        this.status.set(element.id, {
          expanded: false,
          selected: false,
          depth,
          element,
        });
      }
    });
  }

}
