import { Injectable } from '@opensumi/common-di';
import { URI, IDisposable, Disposable, DisposableCollection, MaybePromise } from '@opensumi/ide-core-common';

export interface Variable {

  /**
   * 变量名，也作为唯一标识使用
   */
  readonly name: string;

  /**
   * 描述信息
   */
  readonly description?: string;

  /**
   * 处理返回值
   */
  resolve(context?: URI): MaybePromise<string | undefined>;
}

export const VariableContribution = Symbol('VariableContribution');

export interface VariableContribution {
  registerVariables(variables: VariableRegistry): void;
}

export const VariableRegistry = Symbol('VariableRegistry');

export interface VariableRegistry {
  registerVariable(variable: Variable): IDisposable;
  getVariables(): Variable[];
  getVariable(name: string): Variable | undefined;
  registerVariables(variables: Variable[]): IDisposable[];
}

@Injectable()
export class VariableRegistryImpl implements IDisposable {

  protected readonly variables: Map<string, Variable> = new Map();
  protected readonly toDispose = new DisposableCollection();

  dispose(): void {
    this.toDispose.dispose();
  }

  /**
   * 为给定的变量名注册处理函数
   * 忽略已处理的变量
   */
  registerVariable(variable: Variable): IDisposable {
    if (this.variables.has(variable.name)) {
      console.warn(`A variables with name ${variable.name} is already registered.`);
      return Disposable.NULL;
    }
    this.variables.set(variable.name, variable);
    const disposable = {
      dispose: () => this.variables.delete(variable.name),
    };
    this.toDispose.push(disposable);
    return disposable;
  }

  /**
   * 返回所有已注册的变量
   */
  getVariables(): Variable[] {
    return [...this.variables.values()];
  }

  /**
   * 通过名称获取变量
   */
  getVariable(name: string): Variable | undefined {
    return this.variables.get(name);
  }

  /**
   * 注册多个变量
   */
  registerVariables(variables: Variable[]): IDisposable[] {
    return variables.map((v) => this.registerVariable(v));
  }
}
