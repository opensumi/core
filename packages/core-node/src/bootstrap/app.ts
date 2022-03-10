import cp from 'child_process';
import http from 'http';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';

import Koa from 'koa';

import { Injector, ConstructorOf } from '@opensumi/di';
import { WebSocketHandler } from '@opensumi/ide-connection/lib/node';
import { MaybePromise, ContributionProvider, createContributionProvider, isWindows } from '@opensumi/ide-core-common';
import {
  LogLevel,
  ILogServiceManager,
  ILogService,
  SupportLogNamespace,
  StoragePaths,
} from '@opensumi/ide-core-common';

import { createServerConnection2, createNetServerConnection, RPCServiceCenter } from '../connection';
import { NodeModule } from '../node-module';

import { injectInnerProviders } from './inner-providers';

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
}

export interface AppConfig extends Partial<Config> {
  marketplace: MarketplaceConfig;
}

export interface IServerAppOpts extends Partial<Config> {
  modules?: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: NodeModule[];
  webSocketHandler?: WebSocketHandler[];
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

export class ServerApp implements IServerApp {
  private injector: Injector;

  private config: AppConfig;

  private logger: ILogService;

  private webSocketHandler: WebSocketHandler[];

  private modulesInstances: NodeModule[];

  use: (middleware: Koa.Middleware<Koa.ParameterizedContext<any, any>>) => void;

  protected contributionsProvider: ContributionProvider<ServerAppContribution>;

  /**
   * 启动初始化
   * 1. 绑定 process 报错处理
   * 2. 初始化内置的 Provider
   * 3. 获取 Modules 的实例
   * 4. 设置默认的实例
   * @param opts
   */
  constructor(opts: IServerAppOpts) {
    this.injector = opts.injector || new Injector();
    this.webSocketHandler = opts.webSocketHandler || [];
    // 使用外部传入的中间件
    this.use = opts.use || ((middleware) => null);
    this.config = {
      injector: this.injector,
      logDir: opts.logDir,
      logLevel: opts.logLevel,
      LogServiceClass: opts.LogServiceClass,
      marketplace: Object.assign(
        {
          endpoint: 'https://open-vsx.org/api',
          extensionDir: path.join(
            os.homedir(),
            ...(isWindows ? [StoragePaths.WINDOWS_APP_DATA_DIR, StoragePaths.WINDOWS_ROAMING_DIR] : ['']),
            StoragePaths.DEFAULT_STORAGE_DIR_NAME,
            StoragePaths.MARKETPLACE_DIR,
          ),
          showBuiltinExtensions: false,
          accountId: '',
          masterKey: '',
          ignoreId: [],
        },
        opts.marketplace,
      ),
      processCloseExitThreshold: opts.processCloseExitThreshold,
      terminalPtyCloseThreshold: opts.terminalPtyCloseThreshold,
      staticAllowOrigin: opts.staticAllowOrigin,
      staticAllowPath: opts.staticAllowPath,
      extLogServiceClassPath: opts.extLogServiceClassPath,
      maxExtProcessCount: opts.maxExtProcessCount,
      onDidCreateExtensionHostProcess: opts.onDidCreateExtensionHostProcess,
      extHost: process.env.EXTENSION_HOST_ENTRY || opts.extHost,
      blockPatterns: opts.blockPatterns,
      extHostIPCSockPath: opts.extHostIPCSockPath,
      extHostForkOptions: opts.extHostForkOptions,
    };
    this.bindProcessHandler();
    this.initBaseProvider(opts);
    this.createNodeModules(opts.modules, opts.modulesInstances);
    this.logger = this.injector.get(ILogServiceManager).getLogger(SupportLogNamespace.App);
    this.contributionsProvider = this.injector.get(ServerAppContribution);
  }

  /**
   * 将被依赖但未被加入modules的模块加入到待加载模块最后
   */
  public resolveModuleDeps(moduleConstructor: ModuleConstructor, modules: any[]) {
    const dependencies = Reflect.getMetadata('dependencies', moduleConstructor) as [];
    if (dependencies) {
      dependencies.forEach((dep) => {
        if (modules.indexOf(dep) === -1) {
          modules.push(dep);
        }
      });
    }
  }

  private get contributions(): ServerAppContribution[] {
    return this.contributionsProvider.getContributions();
  }

  private initBaseProvider(opts: IServerAppOpts) {
    // 创建 contributionsProvider
    createContributionProvider(this.injector, ServerAppContribution);

    this.injector.addProviders({
      token: AppConfig,
      useValue: this.config,
    });
    injectInnerProviders(this.injector);
  }

  private async initializeContribution() {
    for (const contribution of this.contributions) {
      if (contribution.initialize) {
        try {
          await contribution.initialize(this);
        } catch (error) {
          this.logger.error('Could not initialize contribution', error);
        }
      }
    }
  }

  private async startContribution() {
    for (const contrib of this.contributions) {
      if (contrib.onStart) {
        try {
          await contrib.onStart(this);
        } catch (error) {
          this.logger.error('Could not start contribution', error);
        }
      }
    }
  }

  async start(
    server: http.Server | https.Server | net.Server,
    serviceHandler?: (serviceCenter: RPCServiceCenter) => void,
  ) {
    await this.initializeContribution();

    let serviceCenter;

    if (serviceHandler) {
      serviceCenter = new RPCServiceCenter();
      serviceHandler(serviceCenter);
    } else {
      if (server instanceof http.Server || server instanceof https.Server) {
        // 创建 websocket 通道
        serviceCenter = createServerConnection2(server, this.injector, this.modulesInstances, this.webSocketHandler);
      } else if (server instanceof net.Server) {
        serviceCenter = createNetServerConnection(server, this.injector, this.modulesInstances);
      }
    }

    // TODO: 每次链接来的时候绑定一次，或者是服务获取的时候多实例化出来
    // bindModuleBackService(this.injector, this.modulesInstances, serviceCenter);

    await this.startContribution();
  }

  private async onStop() {
    for (const contrib of this.contributions) {
      if (contrib.onStop) {
        try {
          await contrib.onStop(this);
        } catch (error) {
          this.logger.error('Could not stop contribution', error);
        }
      }
    }
  }

  /**
   * 绑定 process 退出逻辑
   */
  private bindProcessHandler() {
    process.on('uncaughtException', (error) => {
      if (error) {
        this.logger.error('Uncaught Exception: ', error.toString());
        if (error.stack) {
          this.logger.error(error.stack);
        }
      }
    });
    // Handles normal process termination.
    process.on('exit', () => {
      this.logger.log('process exit');
    });
    // Handles `Ctrl+C`.
    process.on('SIGINT', async () => {
      this.logger.log('process SIGINT');
      await this.onStop();
      this.logger.log('process SIGINT DONE');
      process.exit(0);
    });
    // Handles `kill pid`.
    process.on('SIGTERM', async () => {
      this.logger.log('process SIGTERM');
      await this.onStop();
      this.logger.log('process SIGTERM DONE');
      process.exit(0);
    });
  }

  /**
   * 收集 module 实例
   * @param Constructors
   * @param modules
   */
  private createNodeModules(Constructors: ModuleConstructor[] = [], modules: NodeModule[] = []) {
    const allModules = [...modules];
    Constructors.forEach((c) => {
      this.resolveModuleDeps(c, Constructors);
    });
    for (const Constructor of Constructors) {
      allModules.push(this.injector.get(Constructor));
    }
    for (const instance of allModules) {
      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }

      if (instance.contributionProvider) {
        if (Array.isArray(instance.contributionProvider)) {
          for (const contributionProvider of instance.contributionProvider) {
            createContributionProvider(this.injector, contributionProvider);
          }
        } else {
          createContributionProvider(this.injector, instance.contributionProvider);
        }
      }
    }
    this.modulesInstances = allModules;
  }
}
