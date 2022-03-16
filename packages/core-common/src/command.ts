import { Autowired, Injectable } from '@opensumi/di';

import { MaybePromise } from './async';
import { ContributionProvider } from './contribution-provider';
import { Disposable, IDisposable } from './disposable';
import { replaceLocalizePlaceholder } from './localize';
import { getDebugLogger } from './log';
import { IExtensionInfo } from './types';

type InterceptorFunction = (result: any) => MaybePromise<any>;

export interface Command {
  /**
   * 命令 id，全局唯一
   */
  id: string;
  /**
   * 要在命令面板显示的文案
   * 支持国际化占位符，例如 %evenEditorGroups%
   */
  label?: string;
  /**
   * 要在命令面板显示的图标
   */
  iconClass?: string;
  /**
   * 要在命令面板显示的图标
   */
  toogleIconClass?: string;
  /**
   * 要在命令面板显示的分组
   * 支持国际化占位符，例如 %evenEditorGroups%
   */
  category?: string;

  /**
   * 代理执行的命令
   */
  delegate?: string;

  /**
   * 在任意语言下都相同的别名
   */
  alias?: string;
  /**
   * 是否启用该命令，值为 when 表达式
   * 这个值只影响 UI 是否展示 （命令面板或者菜单）
   */
  enablement?: string;
}

/**
 * Command 的工具方法
 */
export namespace Command {
  /**
   * 判断是否是命令
   * @param arg 要判断的对象
   */
  export function is(arg: Command | any): arg is Command {
    return !!arg && arg === Object(arg) && 'id' in arg;
  }

  /**
   * 比较两个命令是否相等
   * 用于命令面板的排序
   * @param a 待比较的命令
   * @param b 待比较的命令
   */
  export function compareCommands(a: Command, b: Command): number {
    if (a.label && b.label) {
      const aCommand = a.category ? a.category + a.label : a.label;
      const bCommand = b.category ? b.category + b.label : b.label;
      return aCommand.localeCompare(bCommand);
    } else {
      return 0;
    }
  }
}

/**
 * 命令处理函数接口
 */
export interface CommandHandler<T = any> {
  /**
   * 命令执行函数
   * @param args 传递的参数
   */
  execute: T;
  /**
   * 命令是否启用
   * 若为否，则不会被执行到
   * 并且命令面板也不会显示
   * @param args 传递的参数
   */
  isEnabled?(...args: any[]): boolean;
  /**
   * 命令是否可见
   * 若为否，则不会再命令面板显示
   * 但是可以被外部执行
   * @param args 传递的参数
   */
  isVisible?(...args: any[]): boolean;
  /**
   * 是否可切换
   * 主要给菜单使用
   * @param args
   */
  isToggled?(...args: any[]): boolean;
  /**
   * 获取鉴过权的命令处理函数
   * @param commandId 命令 id
   * @param extensionInfo 插件的主要属性
   * @param args 命令其他参数
   */
  isPermitted?(extensionInfo: IExtensionInfo, ...args: any[]): boolean;
}

export const CommandContribution = Symbol('CommandContribution');

/**
 * 命令贡献 Contribution
 * 其他模块如果要注册命令需要实现该接口，并且把 Symbol 定义加入 Domain
 */
export interface CommandContribution {
  /**
   * 注册命令
   */
  registerCommands(commands: CommandRegistry): void;
}

export type PreCommandInterceptor = (command: string, args: any[]) => MaybePromise<any[]>;
export type PostCommandInterceptor = (command: string, result: any) => MaybePromise<any>;

export const CommandService = Symbol('CommandService');
export const CommandRegistry = Symbol('CommandRegistry');

export const HANDLER_NOT_FOUND = 'HANDLER_NOT_FOUND';

/**
 * 命令执行模块
 */
export interface CommandService {
  executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined>;
  /**
   * 执行命令将报错 catch 并 log 输出
   */
  tryExecuteCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined>;
}
/**
 * 命令注册和管理模块
 */
interface CoreCommandRegistry {
  /**
   * 注册命令
   * @param command 要注册的命令
   * @param handler 要绑定的执行函数，可延后添加
   * @returns 销毁命令的方法
   */
  registerCommand<T = any>(command: Command, handler?: CommandHandler<T>): IDisposable;
  /**
   * 解绑命令
   * @param commandOrId 要解绑命令或命令 id
   */
  unregisterCommand(commandOrId: Command | string): void;
  /**
   * 给命令注册处理函数
   * 可以给命令加多个处理函数
   * @param commandId 要添加的命令 id
   * @param handler 要添加的处理函数
   */
  registerHandler<T = any>(commandId: string, handler: CommandHandler<T>): IDisposable;
  /**
   * 通过命令 id 获取命令
   * @param commandId 命令 id
   */
  getCommand(commandId: string): Command | undefined;
  getRawCommand(commandId: string): Command | undefined;
  /**
   * 获取所有命令
   */
  getCommands(): Command[];

  /**
   * 判断命令是否启用
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isEnabled(commandId: string, ...args: any[]): boolean;
  /**
   * 判断命令是否可见
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isVisible(commandId: string, ...args: any[]): boolean;
  /**
   * 判断命令是否可切换
   * @param commandId 命令 id
   */
  isToggled(commandId: string, ...args: any[]): boolean;
  /**
   * 判断命令是否启用
   * @param commandId 命令 id
   * @param args
   */
  getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined;
  /**
   * 获取最近使用的命令列表
   */
  getRecentCommands(): Command[];
  /**
   * 设置最近使用的命令列表
   */
  setRecentCommands(commands: Command[]): Command[];

  beforeExecuteCommand(interceptor: PreCommandInterceptor): IDisposable;

  afterExecuteCommand(interceptor: string | PostCommandInterceptor, result?: InterceptorFunction): IDisposable;
  /**
   * 是否是通过鉴过权的命令
   * @param commandId
   * @param extensionInfo
   * @param args
   */
  isPermittedCommand(commandId: string, extensionInfo: IExtensionInfo, ...args: any[]): boolean;
}

export interface CommandRegistry extends CoreCommandRegistry {
  /**
   * 从 ContributionProvide 中拿到执行命令 Contributuon
   * 执行注册操作
   */
  initialize(): void;
}

// 不带 contribution 的 CommandRegistry
@Injectable()
export class CoreCommandRegistryImpl implements CoreCommandRegistry {
  protected readonly _commands: { [id: string]: Command } = {};
  protected readonly _handlers: { [id: string]: CommandHandler[] } = {};

  protected readonly unregisterCommands = new Map<string, Disposable>();
  // 最近执行的命令列表
  protected readonly _recent: Command[] = [];

  public readonly preCommandInterceptors: PreCommandInterceptor[] = [];

  public readonly postCommandInterceptors: PostCommandInterceptor[] = [];

  private readonly postCommandInterceptor: Map<string, InterceptorFunction[]> = new Map<
    string,
    InterceptorFunction[]
  >();

  private readonly logger = getDebugLogger();

  /**
   * 命令执行方法
   * @param commandId 命令执行方法
   * @param args
   */
  async executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    const command = this.getCommand(commandId);
    // 执行代理命令
    if (command && command.delegate) {
      return this.executeCommand<T>(command.delegate, ...args);
    }
    // 把 before 在 handler 判断前置，对于 onCommand 激活的插件如果没有在 contributes 配置，那么 handler 是不存在的，也就无法激活
    // 如 node debug 插件 https://github.com/microsoft/vscode-node-debug/blob/main/package.json
    for (const preCommand of this.preCommandInterceptors) {
      args = await preCommand(commandId, args);
    }
    const handler = this.getActiveHandler(commandId, ...args);
    if (handler) {
      let result = await handler.execute(...args);
      const commandInterceptor = this.postCommandInterceptor.get(commandId);
      if (commandInterceptor) {
        for (const postInterceptor of commandInterceptor) {
          result = await postInterceptor(result);
        }
      }
      for (const postCommand of this.postCommandInterceptors) {
        result = await postCommand(commandId, result);
      }
      return result;
    }
    let argsMessage = '';
    try {
      argsMessage = args && args.length > 0 ? ` (args: ${JSON.stringify(args)})` : '';
    } catch (e) {
      argsMessage = 'args cannot be convert to JSON';
    }
    const err = new Error(
      `The command '${commandId}' cannot be executed. There are no active handlers available for the command.${argsMessage}`,
    );
    err.name = HANDLER_NOT_FOUND;
    throw err;
  }

  /**
   * 获取所有命令
   */
  getCommands(): Command[] {
    return Object.keys(this._commands).map((id) => this.getCommand(id)!);
  }

  /**
   * 注册命令，命令不能重复注册
   * @param command
   * @param handler
   * @returns 命令销毁函数
   */
  registerCommand<T>(command: Command, handler?: CommandHandler<T>): IDisposable {
    if (this._commands[command.id]) {
      this.logger.warn(`A command ${command.id} is already registered.`);
      return Disposable.NULL;
    }
    const toDispose = new Disposable();
    // 添加命令的销毁函数
    toDispose.addDispose(this.doRegisterCommand(command));
    if (handler) {
      // 添加处理函数的销毁函数
      toDispose.addDispose(this.registerHandler(command.id, handler));
    }
    // 添加解绑时的销毁逻辑
    this.unregisterCommands.set(command.id, toDispose);
    toDispose.addDispose(Disposable.create(() => this.unregisterCommands.delete(command.id)));
    return toDispose;
  }

  /**
   * 解绑命令
   * @param command 命令
   */
  unregisterCommand(command: Command): void;
  /**
   * 解绑命令
   * @param id 命令 id
   */
  unregisterCommand(commandOrId: Command | string): void {
    const id = Command.is(commandOrId) ? commandOrId.id : commandOrId;
    const unregisterCommand = this.unregisterCommands.get(id);
    if (unregisterCommand) {
      unregisterCommand.dispose();
    }
  }

  /**
   * 给命令注册处理函数
   * 可以给命令加多个处理函数
   * 默认后面注册的优先级更高
   * @param commandId 要添加的命令 id
   * @param handler 要添加的处理函数
   * @returns 销毁函数
   */
  registerHandler<T>(commandId: string, handler: CommandHandler<T>): IDisposable {
    let handlers = this._handlers[commandId];
    if (!handlers) {
      this._handlers[commandId] = handlers = [];
    }
    handlers.unshift(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) {
          handlers.splice(idx, 1);
        }
      },
    };
  }

  /**
   * 判断命令是否启用
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isEnabled(command: string, ...args: any[]): boolean {
    if (!this._handlers[command]) {
      // 对于插件package.json中注册的command，会没有handler，
      // 但是它应该可用，这样才能让插件在未启动的情况下点击菜单
      return true;
    }
    return this.getActiveHandler(command, ...args) !== undefined;
  }

  /**
   * 判断命令是否可见
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isVisible(command: string, ...args: any[]): boolean {
    if (!this._handlers[command]) {
      // 对于插件package.json中注册的command，会没有handler，
      // 但是它应该可见，这样才能让插件在未启动的情况下显示菜单
      return true;
    }
    return this.getVisibleHandler(command, ...args) !== undefined;
  }

  /**
   * 是否可切换
   * 主要给菜单使用
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isToggled(command: string, ...args: any[]): boolean {
    const handler = this.getToggledHandler(command);
    return handler && handler.isToggled ? handler.isToggled(...args) : false;
  }

  /**
   * 获取可见的命令处理函数
   * @param commandId 命令 id
   * @param args 传递参数
   */
  protected getVisibleHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (!handler.isVisible || handler.isVisible(...args)) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * 获取启用的命令处理函数
   * @param commandId 命令 id
   * @param args
   */
  getActiveHandler(commandId: string, ...args: any[]): CommandHandler | undefined {
    const command = this.getCommand(commandId);
    if (command && command.delegate) {
      return this.getActiveHandler(command.delegate, ...args);
    }
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (!handler.isEnabled || handler.isEnabled(...args)) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * 获取鉴过权的命令处理函数
   * @param commandId 命令 id
   * @param extensionInfo 插件的主要属性
   * @param args 命令其他参数
   */
  isPermittedCommand(commandId: string, extensionInfo: IExtensionInfo, ...args: any[]): boolean {
    const command = this.getCommand(commandId);
    if (command && command.delegate) {
      return this.isPermittedCommand(command.delegate, extensionInfo, ...args);
    }
    const handlers = this._handlers[commandId];
    return (
      !Array.isArray(handlers) ||
      handlers.every((handler) => !handler.isPermitted || handler.isPermitted(extensionInfo, ...args))
    );
  }

  /**
   * 获取可切换的命令处理函数
   * @param commandId 命令 id
   */
  protected getToggledHandler(commandId: string): CommandHandler | undefined {
    const handlers = this._handlers[commandId];
    if (handlers) {
      for (const handler of handlers) {
        if (handler.isToggled) {
          return handler;
        }
      }
    }
    return undefined;
  }

  /**
   * 解决语言包未加载时注册命令时没有 label/category 的场景
   * 使用方需要自定处理 i18n 问题
   */
  getRawCommand(id: string): Command | undefined {
    const command = this._commands[id];
    return command;
  }

  /**
   * 通过命令 id 获取命令
   * @param commandId 命令 id
   */
  getCommand(id: string): Command | undefined {
    const command = this._commands[id];
    return command
      ? {
          ...command,
          category: replaceLocalizePlaceholder(command.category),
          label: replaceLocalizePlaceholder(command.label),
        }
      : undefined;
  }

  /**
   * 给命令添加销毁函数
   * @param command 要添加销毁函数的命令
   */
  protected doRegisterCommand(command: Command): IDisposable {
    this._commands[command.id] = command;
    return {
      dispose: () => {
        delete this._commands[command.id];
      },
    };
  }

  public beforeExecuteCommand(interceptor: PreCommandInterceptor): IDisposable {
    this.preCommandInterceptors.push(interceptor);
    return {
      dispose: () => {
        const index = this.preCommandInterceptors.indexOf(interceptor);
        if (index !== -1) {
          this.preCommandInterceptors.splice(index, 1);
        }
      },
    };
  }

  public afterExecuteCommand(command: string, result: InterceptorFunction);
  public afterExecuteCommand(interceptor: string | PostCommandInterceptor, result?: InterceptorFunction) {
    if (typeof interceptor === 'string') {
      const commandInterceptor = this.postCommandInterceptor.get(interceptor);
      if (commandInterceptor) {
        result && commandInterceptor.push(result);
      } else {
        result && this.postCommandInterceptor.set(interceptor, [result]);
      }
      return {
        dispose: () => {
          const commandInterceptor = this.postCommandInterceptor.get(interceptor);
          if (commandInterceptor && result) {
            const index = commandInterceptor.indexOf(result);
            if (index !== -1) {
              commandInterceptor.splice(index, 1);
            }
          }
        },
      };
    } else {
      this.postCommandInterceptors.push(interceptor);
      return {
        dispose: () => {
          const index = this.postCommandInterceptors.indexOf(interceptor);
          if (index !== -1) {
            this.postCommandInterceptors.splice(index, 1);
          }
        },
      };
    }
  }

  /**
   * 获取最近使用的命令列表
   */
  getRecentCommands() {
    return this._recent;
  }

  /**
   * 获取最近使用的命令列表
   */
  setRecentCommands(commands: Command[]) {
    commands.forEach((command: Command) => {
      this.addRecentCommand(command);
    });
    return this._recent;
  }

  /**
   * 添加一个命令到最近使用列表中
   * @param recent 待添加的命令
   */
  protected addRecentCommand(recent: Command): void {
    if (!recent || !recent.label) {
      return; // 某些情况会报错
    }
    // 确定命令当前是否存在于最近使用的列表中
    const index = this._recent.findIndex((command) => command.id === recent.id);
    // 如果已经存在，则从最近使用的列表中删除
    if (index >= 0) {
      this._recent.splice(index, 1);
    }
    // 将这个命令添加到最近使用的列表的第一位
    this._recent.unshift(recent);
  }
}

@Injectable()
export class CommandRegistryImpl extends CoreCommandRegistryImpl implements CommandRegistry {
  @Autowired(CommandContribution)
  protected readonly contributionProvider: ContributionProvider<CommandContribution>;

  /**
   * 执行 CommandContribution 的注册方法
   */
  initialize(): void {
    const contributions = this.contributionProvider.getContributions();
    for (const contrib of contributions) {
      contrib.registerCommands(this);
    }
  }
}

@Injectable()
export class CommandServiceImpl implements CommandService {
  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistryImpl;

  executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    return this.commandRegistry.executeCommand(commandId, ...args);
  }

  async tryExecuteCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    try {
      return await this.executeCommand(commandId, ...args);
    } catch (err) {
      // no-op: failed when command not found
      getDebugLogger().warn(err);
    }
  }
}
