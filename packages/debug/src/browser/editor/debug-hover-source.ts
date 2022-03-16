import { Injectable, Autowired } from '@opensumi/di';
import { Event, Emitter } from '@opensumi/ide-core-browser';

import { IDebugSessionManager } from '../../common';
import { DebugSessionManager } from '../debug-session-manager';
import {
  DebugVariable,
  DebugScope,
  DebugVariableContainer,
  DebugHoverVariableRoot,
} from '../tree/debug-tree-node.define';


export type ExpressionVariable = DebugHoverVariableRoot | DebugVariable | DebugVariableContainer | undefined;

@Injectable()
export class DebugHoverSource {
  @Autowired(IDebugSessionManager)
  protected readonly sessions: DebugSessionManager;

  private onDidChangeEmitter: Emitter<ExpressionVariable> = new Emitter();
  onDidChange: Event<ExpressionVariable> = this.onDidChangeEmitter.event;

  dispose(): void {
    this._expression = undefined;
  }

  protected _expression: ExpressionVariable;
  get expression(): ExpressionVariable {
    return this._expression;
  }

  public clearEvaluate(): void {
    this.onDidChangeEmitter.fire(undefined);
  }

  async evaluate(expression: string): Promise<ExpressionVariable> {
    const evaluated = await this.doEvaluate(expression);
    this._expression = evaluated;
    this.onDidChangeEmitter.fire(evaluated);
    return evaluated;
  }

  protected async doEvaluate(expression: string): Promise<ExpressionVariable> {
    const { currentSession } = this.sessions;
    if (!currentSession) {
      return undefined;
    }
    if (currentSession.capabilities.supportsEvaluateForHovers) {
      const item = new DebugHoverVariableRoot(expression, currentSession);
      await item.evaluate('hover');
      return (item.available && item) || undefined;
    }
    return this.findVariable(
      expression
        .split('.')
        .map((word) => word.trim())
        .filter((word) => !!word),
    );
  }

  protected async findVariable(namesToFind: string[]): Promise<DebugVariable | DebugVariableContainer | undefined> {
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
        // 仅显示找到的所有表达式是否具有相同的值
        return undefined;
      }
    }
    return variable;
  }

  protected async doFindVariable(
    owner: DebugScope | DebugVariableContainer,
    namesToFind: string[],
  ): Promise<DebugVariable | undefined> {
    await owner.ensureLoaded();
    const elements = owner.children;
    const variables: (DebugVariable | DebugVariableContainer)[] = [];
    if (!elements) {
      return;
    }
    for (const element of elements) {
      if (element instanceof DebugVariableContainer || element instanceof DebugVariable) {
        if (element.name === namesToFind[0]) {
          variables.push(element);
        }
      }
    }
    if (variables.length !== 1) {
      return undefined;
    }
    if (namesToFind.length === 1) {
      return variables[0] as DebugVariable;
    } else {
      return this.doFindVariable(variables[0] as DebugVariableContainer, namesToFind.slice(1));
    }
  }
}
