import { Injectable, Autowired } from '@ali/common-di';
import { IDisposable, Disposable } from './disposable';
import { ContributionProvider } from './contribution-provider';
import { MaybePromise } from './async';

export interface Command {
  /**
   * 命令 id，全局唯一
   */
  id: string;
  /**
   * 要在命令面板显示的文案
   */
  label?: string;
  /**
   * 要在命令面板显示的图标
   */
  iconClass?: string;
  /**
   * 要在命令面板显示的分组
   */
  category?: string;

  /**
   * 代理执行的命令
   */
  delegate?: string;
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
export interface CommandHandler {
  /**
   * 命令执行函数
   * @param args 传递的参数
   */
  execute(...args: any[]): any;
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
}

export const CommandContribution = Symbol('CommandContribution');

/**
 * 命令贡献 Contribution
 * 其他模块如果要注册命令需要实现该接口，并且把 Symbol 定义加入 Domain
 * 参考 https://yuque.antfin-inc.com/zymuwz/lsxfi3/yfe5nw#aDonI
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

/**
 * 命令执行模块
 */
export interface CommandService {
  executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined>;
}
/**
 * 命令注册和管理模块
 */
export interface CommandRegistry {
  /**
   * 注册命令
   * @param command 要注册的命令
   * @param handler 要绑定的执行函数，可延后添加
   * @returns 销毁命令的方法
   */
  registerCommand(command: Command, handler?: CommandHandler): IDisposable;
  /**
   * 从 ContributionProvide 中拿到执行命令 Contributuon
   * 执行注册操作
   */
  onStart(): void;
  /**
   * 解绑命令
   * @param command 要解绑的命令
   */
  unregisterCommand(command: Command): void;
  /**
   * 解绑命令
   * @param id 要解绑命令 id
   */
  unregisterCommand(id: string): void;
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
  registerHandler(commandId: string, handler: CommandHandler): IDisposable;
  /**
   * 通过命令 id 获取命令
   * @param commandId 命令 id
   */
  getCommand(commandId: string): Command | undefined;
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

  afterExecuteCommand(interceptor: PostCommandInterceptor): IDisposable;

}

@Injectable()
export class CommandServiceImpl implements CommandService {

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistryImpl;

  executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    return this.commandRegistry.executeCommand(commandId, ...args);
  }
}

@Injectable()
export class CommandRegistryImpl implements CommandRegistry {

  @Autowired(CommandContribution)
  protected readonly contributionProvider: ContributionProvider<CommandContribution>

  protected readonly _commands: { [id: string]: Command } = {};
  protected readonly _handlers: { [id: string]: CommandHandler[] } = {};
  // 最近执行的命令列表
  protected readonly _recent: Command[] = [];

  public readonly preCommandInterceptors: PreCommandInterceptor[] = [];

  public readonly postCommandInterceptors: PostCommandInterceptor[] = [];

  /**
   * 命令执行方法
   * @param commandId 命令执行方法
   * @param args
   */
  async executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    const command = this.getCommand(commandId);
    // 执行代理命令
    if(command && command.delegate) {
      return this.executeCommand<T>(command.delegate, ...args);
    }
    const handler = this.getActiveHandler(commandId, ...args);
    if (handler) {
      for (const preCommand of this.preCommandInterceptors) {
        args = await preCommand(commandId, args);
      }
      let result = await handler.execute(...args);
      for (const postCommand of this.postCommandInterceptors) {
        result = await postCommand(commandId, result);
      }
      const command = this.getCommand(commandId);
      if (command) {
        this.addRecentCommand(command);
      }
      return result;
    }
    const argsMessage = args && args.length > 0 ? ` (args: ${JSON.stringify(args)})` : '';
    throw new Error(
      `The command '${commandId}' cannot be executed. There are no active handlers available for the command.${argsMessage}`
    );
  }

  /**
   * 获取所有命令
   */
  getCommands(): Command[] {
    return Object.keys(this._commands).map(id => this.getCommand(id)!);
  }

  /**
   * 执行 CommandContribution 的注册方法
   */
  onStart(): void {
    const contributions = this.contributionProvider.getContributions();
    for (const contrib of contributions) {
      contrib.registerCommands(this);
    }
  }

  /**
   * 注册命令，命令不能重复注册
   * @param command
   * @param handler
   * @returns 命令销毁函数
   */
  registerCommand(command: Command, handler?: CommandHandler): IDisposable {
    if (this._commands[command.id]) {
      console.warn(`A command ${command.id} is already registered.`);
      return Disposable.NULL;
    }
    if (handler) {
      const toDispose = new Disposable();
      // 添加命令的销毁函数
      toDispose.addDispose(this.doRegisterCommand(command));
      // 添加处理函数的销毁函数
      toDispose.addDispose(this.registerHandler(command.id, handler));
      return toDispose;
    }
    return this.doRegisterCommand(command);
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
  unregisterCommand(id: string): void;
  unregisterCommand(commandOrId: Command | string): void {
    const id = Command.is(commandOrId) ? commandOrId.id : commandOrId;

    if (this._commands[id]) {
      delete this._commands[id];
    }
  }

  /**
   * 给命令注册处理函数
   * 可以给命令加多个处理函数
   * @param commandId 要添加的命令 id
   * @param handler 要添加的处理函数
   * @returns 销毁函数
   */
  registerHandler(commandId: string, handler: CommandHandler): IDisposable {
    let handlers = this._handlers[commandId];
    if (!handlers) {
      this._handlers[commandId] = handlers = [];
    }
    handlers.push(handler);
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
    return this.getActiveHandler(command, ...args) !== undefined;
  }

  /**
   * 判断命令是否可见
   * @param commandId 命令 id
   * @param args 传递参数
   */
  isVisible(command: string, ...args: any[]): boolean {
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
      return this.getActiveHandler(command.delegate, ...args)
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
   * 通过命令 id 获取命令
   * @param commandId 命令 id
   */
  getCommand(id: string): Command | undefined {
    return this._commands[id];
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
      }
    }
  }

  public afterExecuteCommand(interceptor: PostCommandInterceptor) {
    this.postCommandInterceptors.push(interceptor);
    return {
      dispose: () => {
        const index = this.postCommandInterceptors.indexOf(interceptor);
        if (index !== -1) {
          this.postCommandInterceptors.splice(index, 1);
        }
      }
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
      this.addRecentCommand(command)
    })
    return this._recent;
  }

  /**
   * 添加一个命令到最近使用列表中
   * @param recent 待添加的命令
   */
  protected addRecentCommand(recent: Command): void {
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
