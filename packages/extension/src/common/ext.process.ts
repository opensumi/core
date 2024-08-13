import type { SumiApiExtenders } from './sumi';
import type { CommandHandler } from './vscode';
import type { ConstructorOf, Injector } from '@opensumi/di';
import type { ILogService, LogLevel } from '@opensumi/ide-core-common';
import type Stream from 'stream';

export interface IBuiltInCommand {
  id: string;
  handler: CommandHandler;
}

export interface CustomChildProcess {
  stdin: Stream.Writable;
  stdout: Stream.Readable;
  kill: () => void;
}

export interface CustomChildProcessModule {
  spawn(command: string, args: string | string[], options: any): CustomChildProcess;
}

export const ExtHostAppConfig = Symbol('ExtHostAppConfig');
export interface ExtHostAppConfig {
  /**
   * exthost log service class
   */
  LogServiceClass?: ConstructorOf<ILogService>;
  /**
   * 插件日志自定义实现路径
   */
  extLogServiceClassPath?: string;
  logDir?: string;
  logLevel?: LogLevel;
  builtinCommands?: IBuiltInCommand[];
  customDebugChildProcess?: CustomChildProcessModule;
  /**
   * 集成方自定义 vscode.version 版本
   * 设置该参数可能会导致插件运行异常
   * @type {string} 插件版本号
   * @memberof ExtHostAppConfig
   */
  customVSCodeEngineVersion?: string;
  /**
   * control rpcProtocol message timeout
   * default -1，it means disable
   */
  rpcMessageTimeout?: number;
  /**
   * register external sumi extension api
   */
  sumiApiExtenders?: SumiApiExtenders;
}

export interface ExtProcessConfig extends ExtHostAppConfig {
  injector?: Injector;
}
