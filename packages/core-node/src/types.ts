import { NodeModule } from './node-module';

import type { Injector } from '@opensumi/di';
import type { WebSocketHandler } from '@opensumi/ide-connection/lib/node';
import type { ConstructorOf, ILogService, LogLevel, MaybePromise } from '@opensumi/ide-core-common';
import type cp from 'child_process';
import type http from 'http';
import type https from 'https';
import type Koa from 'koa';
import type ws from 'ws';

export { NodeModule };

export type ModuleConstructor = ConstructorOf<NodeModule>;
export type ContributionConstructor = ConstructorOf<ServerAppContribution>;

export const AppConfig = Symbol('AppConfig');

export interface MarketplaceRequest {
  path?: string;
  headers?: {
    [header: string]: string | string[] | undefined;
  };
}

export interface MarketplaceConfig {
  endpoint: string;
  // 插件市场下载到本地的位置，默认 ~/.sumi/extensions
  extensionDir: string;
  // 是否显示内置插件，默认隐藏
  showBuiltinExtensions: boolean;
  // 插件市场中申请到的客户端的 accountId
  accountId: string;
  // 插件市场中申请到的客户端的 masterKey
  masterKey: string;
  // 插件市场参数转换函数
  transformRequest?: (request: MarketplaceRequest) => MarketplaceRequest;
  // 在热门插件、搜索插件时忽略的插件 id
  ignoreId: string[];
}

interface Config {
  /**
   * 初始化的 DI 实例，一般可在外部进行 DI 初始化之后传入，便于提前进行一些依赖的初始化
   */
  injector: Injector;
  /**
   * 设置落盘日志级别，默认为 Info 级别的log落盘
   */
  logLevel?: LogLevel;
  /**
   * 设置日志的目录，默认：~/.sumi/logs
   */
  logDir?: string;
  /**
   * @deprecated 可通过在传入的 `injector` 初始化 `ILogService` 进行实现替换
   * 外部设置的 ILogService，替换默认的 logService
   */
  LogServiceClass?: ConstructorOf<ILogService>;
  /**
   * 启用插件进程的最大个数
   */
  maxExtProcessCount?: number;
  /**
   * 插件日志自定义实现路径
   */
  extLogServiceClassPath?: string;
  /**
   * 插件进程关闭时间
   */
  processCloseExitThreshold?: number;
  /**
   * 终端 pty 进程退出时间
   */
  terminalPtyCloseThreshold?: number;
  /**
   * 访问静态资源允许的 origin
   */
  staticAllowOrigin?: string;
  /**
   * 访问静态资源允许的路径，用于配置静态资源的白名单规则
   */
  staticAllowPath?: string[];
  /**
   * 文件服务禁止访问的路径，使用 glob 匹配
   */
  blockPatterns?: string[];
  /**
   * 获取插件进程句柄方法
   * @deprecated 自测 1.30.0 后，不在提供给 IDE 后端发送插件进程的方法
   */
  onDidCreateExtensionHostProcess?: (cp: cp.ChildProcess) => void;
  /**
   * Watcher Node 进程入口文件
   */
  watcherHost?: string;
  /**
   * 插件 Node 进程入口文件
   */
  extHost?: string;
  /**
   * 插件进程存放用于通信的 sock 地址
   * 默认为 /tmp
   */
  extHostIPCSockPath?: string;
  /**
   * 插件进程 fork 配置
   */
  extHostForkOptions?: Partial<cp.ForkOptions>;
  /**
   * 配置关闭 keytar 校验能力，默认开启
   */
  disableKeytar?: boolean;
  /**
   * control rpcProtocol message timeout
   * default -1，it means disable
   */
  rpcMessageTimeout?: number;
  collaborationOptions?: ICollaborationServerOpts;
}

export interface AppConfig extends Partial<Config> {
  marketplace: MarketplaceConfig;
}

export interface ICollaborationServerOpts {
  port?: number;
}

export interface IServerAppOpts extends Partial<Config> {
  modules?: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: NodeModule[];
  webSocketHandler?: WebSocketHandler[];
  wsServerOptions?: ws.ServerOptions;
  pathMatchOptions?: {
    // When true the regexp will match to the end of the string.
    end?: boolean;
  };
  marketplace?: Partial<MarketplaceConfig>;
  use?(middleware: Koa.Middleware<Koa.ParameterizedContext<any, any>>): void;
}

export const ServerAppContribution = Symbol('ServerAppContribution');

export interface ServerAppContribution {
  initialize?(app: IServerApp): MaybePromise<void>;
  onStart?(app: IServerApp): MaybePromise<void>;
  onStop?(app: IServerApp): MaybePromise<void>;
  onWillUseElectronMain?(): void;
}

export interface IServerApp {
  use(middleware: Koa.Middleware<Koa.ParameterizedContext<any, any>>): void;
  start(server: http.Server | https.Server): Promise<void>;
}
