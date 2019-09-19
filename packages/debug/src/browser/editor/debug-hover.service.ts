import { Injectable, Autowired } from '@ali/common-di';
import { observable, action } from 'mobx';
import { DebugHoverSource, ExpressionVariable } from './debug-hover-source';

@Injectable()
export class DebugHoverService {

  @Autowired(DebugHoverSource)
  protected readonly hoverSource: DebugHoverSource;

  constructor() {
    if (this.hoverSource.expression) {
      this.value = this.hoverSource.expression.value;
    }
    this.hoverSource.onDidChange((expression) => {
      this.updateExpression(expression);
    });
  }

  @observable
  value: string;

  @action
  updateExpression(expression: ExpressionVariable ) {
    if (expression) {
      this.value = expression.value;
    }
  }

}
