import { DebugSessionManager } from '../debug-session-manager';
import { ExpressionContainer, ExpressionItem, DebugVariable } from '../console/debug-console-items';
import { Injectable, Autowired } from '@ali/common-di';
import { IDebugSessionManager } from '../../common';
import { Event, Emitter } from '@ali/ide-core-browser';

export type ExpressionVariable = ExpressionItem | DebugVariable | undefined;

@Injectable()
export class DebugHoverSource {

  @Autowired(IDebugSessionManager)
  protected readonly sessions: DebugSessionManager;

  private onDidChangeEmitter: Emitter<ExpressionVariable> = new Emitter();
  onDidChange: Event<ExpressionVariable> = this.onDidChangeEmitter.event;

  protected _expression: ExpressionVariable;
  get expression(): ExpressionVariable {
    return this._expression;
  }

  async evaluate(expression: string): Promise<boolean> {
    const evaluated = await this.doEvaluate(expression);
    this._expression = evaluated;
    this.onDidChangeEmitter.fire(evaluated);
    return !!evaluated;
  }

  protected async doEvaluate(expression: string): Promise<ExpressionVariable> {
    const { currentSession } = this.sessions;
    if (!currentSession) {
      return undefined;
    }
    if (currentSession.capabilities.supportsEvaluateForHovers) {
      const item = new ExpressionItem(expression, currentSession);
      await item.evaluate('hover');
      return item.available && item || undefined;
    }
    return this.findVariable(expression.split('.').map((word) => word.trim()).filter((word) => !!word));
  }

  protected async findVariable(namesToFind: string[]): Promise<DebugVariable | undefined> {
    const { currentFrame } = this.sessions;
    if (!currentFrame) {
      return undefined;
    }
    let variable: DebugVariable | undefined;
    const scopes = await currentFrame.getScopes();
    for (const scope of scopes) {
      const found = await this.doFindVariable(scope, namesToFind);
      if (!variable) {
        variable = found;
      } else if (found && found.value !== variable.value) {
        // only show if all expressions found have the same value
        return undefined;
      }
    }
    return variable;
  }

  protected async doFindVariable(owner: ExpressionContainer, namesToFind: string[]): Promise<DebugVariable | undefined> {
    const elements = await owner.getElements();
    const variables: DebugVariable[] = [];
    for (const element of elements) {
      if (element instanceof DebugVariable && element.name === namesToFind[0]) {
        variables.push(element);
      }
    }
    if (variables.length !== 1) {
      return undefined;
    }
    if (namesToFind.length === 1) {
      return variables[0];
    } else {
      return this.doFindVariable(variables[0], namesToFind.slice(1));
    }
  }

}
