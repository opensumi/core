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

  constructor() {
    if (this.hoverSource.expression) {
      this.value = this.hoverSource.expression.value;
    }
    this.hoverSource.onDidChange((expression) => {
      this.updateExpression(expression);
    });
  }

  get nodes(): TreeNode[] {
    return this.elements.map((element) => {
      if (element instanceof DebugVariable) {
        console.log(element);
        return {
          name: element.name,
          description: element.description,
          descriptionClass: element.descriptionClass,
          labelClass: element.labelClass,
          afterLabel: element.afterLabel,
        } as TreeNode;
      } else {
        return {
          name: element.value,
          description: element.value,
        } as TreeNode;
      }
    });
  }

  @action
  async updateExpression(expression: ExpressionVariable ) {
    if (expression) {
      this.value = expression.value;
      this.elements = await expression.getChildren() as (DebugVariable | ExpressionItem )[];
    }
  }

}
