import { Injectable, Autowired } from '@opensumi/di';
import { isWindows, Variable, VariableRegistry } from '@opensumi/ide-core-browser';

import { VariableResolveOptions, IVariableResolverService } from '../common';

@Injectable()
export class VariableResolverService implements IVariableResolverService {
  protected static VAR_REGEXP = /\$\{(.*?)\}/g;

  @Autowired(VariableRegistry)
  protected readonly variableRegistry: VariableRegistry;

  /**
   * 处理给定的变量数组
   * @param value 需要处理的变量数组
   * @param options 处理参数
   */
  resolveArray(value: string[], options: VariableResolveOptions = {}): Promise<string[]> {
    return this.resolve(value, options);
  }

  /**
   * 变量处理函数
   * @param value 变量
   * @param options 处理参数
   */
  async resolve<T>(value: T, options: VariableResolveOptions = {}): Promise<T> {
    const context = new VariableResolverService.Context(this.variableRegistry, options);
    const resolved = await this.doResolve(value, context);
    return resolved as any;
  }

  /**
   * 实际处理函数
   * @param value
   * @param context
   */
  protected async doResolve(value: any, context: VariableResolverService.Context): Promise<any> {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value === 'string') {
      return this.doResolveString(value, context);
    }
    if (Array.isArray(value)) {
      return this.doResolveArray(value, context);
    }
    if (typeof value === 'object') {
      return this.doResolveObject(value, context);
    }
    return value;
  }

  /**
   * 获取对象值
   * @param obj
   * @param context
   */
  protected async doResolveObject(obj: object, context: VariableResolverService.Context): Promise<object> {
    const result: {
      [prop: string]: any;
    } = {};
    for (const name of Object.keys(obj)) {
      const value = (obj as any)[name];
      const resolved = await this.doResolve(value, context);
      result[name] = resolved;
    }
    return result;
  }

  /**
   * 获取数组值
   * @param values
   * @param context
   */
  protected async doResolveArray(values: Array<any>, context: VariableResolverService.Context): Promise<Array<any>> {
    const result: any[] = [];
    for (const value of values) {
      const resolved = await this.doResolve(value, context);
      result.push(resolved);
    }
    return result;
  }

  /**
   * 获取字符串值
   * @param value
   * @param context
   */
  protected async doResolveString(value: string, context: VariableResolverService.Context): Promise<string> {
    await this.resolveVariables(value, context);
    return value.replace(VariableResolverService.VAR_REGEXP, (match: string, varName: string) => {
      const varValue = context.get(varName);
      return varValue !== undefined ? varValue : match;
    });
  }

  protected async resolveVariables(value: string, context: VariableResolverService.Context): Promise<void> {
    let match;
    while ((match = VariableResolverService.VAR_REGEXP.exec(value)) !== null) {
      const variableName = match[1];
      await context.resolve(variableName);
    }
  }
}

export namespace VariableResolverService {
  export class Context {
    protected readonly resolved = new Map<string, string | undefined>();

    constructor(
      protected readonly variableRegistry: VariableRegistry,
      protected readonly options: VariableResolveOptions,
    ) {}

    private async evaluateSingleVariable(name: string): Promise<string | undefined> {
      let variable: Variable | undefined;

      const parts = name.split(':');
      if (parts.length > 1) {
        const [key, value] = parts;
        variable = this.variableRegistry.getVariable(key);

        switch (key) {
          case 'env': {
            const environment = variable && (await variable.resolve(this.options.context));
            if (!environment) {
              return;
            }
            const env = environment[isWindows ? value.toLowerCase() : value];
            return env;
          }
          default:
            break;
        }
      } else {
        const variable = this.variableRegistry.getVariable(name);
        const value = variable && (await variable.resolve(this.options.context));
        return value as string;
      }
    }

    get(name: string): string | undefined {
      return this.resolved.get(name);
    }

    async resolve(name: string): Promise<void> {
      if (this.resolved.has(name)) {
        return;
      }
      try {
        const value = await this.evaluateSingleVariable(name);
        this.resolved.set(name, value);
      } catch (e) {
        this.resolved.set(name, undefined);
      }
    }
  }
}
