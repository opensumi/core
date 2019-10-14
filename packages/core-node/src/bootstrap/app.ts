import { Injector, ConstructorOf } from '@ali/common-di';
import * as Koa from 'koa';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { MaybePromise, ContributionProvider, createContributionProvider, isWindows } from '@ali/ide-core-common';
import { bindModuleBackService, createServerConnection2, createNetServerConnection, RPCServiceCenter } from '../connection';
import { NodeModule } from '../node-module';
import { WebSocketHandler } from '@ali/ide-connection/lib/node';
import { LogLevel, ILogServiceManager, ILogService, SupportLogNamespace } from '@ali/ide-core-common';
import { INodeLogger, NodeLogger } from '../logger/node-logger';
import * as os from 'os';
import * as path from 'path';
import { ExtensionPaths } from '../storage';

export type ModuleConstructor = ConstructorOf<NodeModule>;
export type ContributionConstructor = ConstructorOf<ServerAppContribution>;

export const AppConfig = Symbol('AppConfig');

export interface MarketplaceConfig {
  // 插件市场地址, 默认 https://marketplace.antfin-inc.com
  endpoint: string;
  // 插件市场下载到本地的位置，默认 ~/.kaitian/extensions
  extensionDir: string;
  // 是否显示内置插件，默认隐藏
  showBuiltinExtensions: boolean;
  // 插件市场中申请到的客户端的 accountId
  accountId: string;
  // 插件市场中申请到的客户端的 masterKey
  masterKey: string;
}

interface Config {
  injector: Injector;
  workspaceDir: string;
  coreExtensionDir?: string;
  extensionDir?: string;

  /**
   * 设置落盘日志级别，默认为 Info 级别的log落盘
  */
  logLevel?: LogLevel;
  /**
   * 设置日志的目录，默认：~/.kaitian/logs
   */
  logDir?: string;
}

export interface AppConfig extends Partial<Config> {
  marketplace: MarketplaceConfig;
  processCloseExitThreshold?: number;
}

export interface IServerAppOpts extends Partial<Config> {
  modules?: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: NodeModule[];
  webSocketHandler?: WebSocketHandler[];
  marketplace?: Partial<MarketplaceConfig>;
  use?(middleware: Koa.Middleware<Koa.ParameterizedContext<any, {}>>): void;
  processCloseExitThreshold?: number;
}

export const ServerAppContribution = Symbol('ServerAppContribution');

export interface ServerAppContribution {
  initialize?(app: IServerApp): MaybePromise<void>;
  onStart?(app: IServerApp): MaybePromise<void>;
  onStop?(app: IServerApp): MaybePromise<void>;
  onWillUseElectronMain?(): void;
}

export interface IServerApp {
  use(middleware: Koa.Middleware<Koa.ParameterizedContext<any, {}>>): void;
  start(server: http.Server | https.Server): Promise<void>;
}

export class ServerApp implements IServerApp {

  private injector: Injector;

  private config: AppConfig;

  private logger: ILogService;

  private webSocketHandler: WebSocketHandler[];

  private modulesInstances: NodeModule[];

  use: (middleware: Koa.Middleware<Koa.ParameterizedContext<any, {}>>) => void;

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
      workspaceDir: opts.workspaceDir || '',
      extensionDir: opts.extensionDir,
      coreExtensionDir: opts.coreExtensionDir,
      logDir: opts.logDir,
      logLevel: opts.logLevel,
      marketplace: Object.assign({
        endpoint: 'https://marketplace.antfin-inc.com',
        extensionDir: path.join(
          os.homedir(),
          ...(isWindows ? [ExtensionPaths.WINDOWS_APP_DATA_DIR, ExtensionPaths.WINDOWS_ROAMING_DIR] : ['']),
          ExtensionPaths.KAITIAN_DIR,
          ExtensionPaths.MARKETPLACE_DIR,
        ),
        showBuiltinExtensions: false,
        accountId: '',
        masterKey: '',
      }, opts.marketplace),
      processCloseExitThreshold: opts.processCloseExitThreshold,
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
    }, {
      token: INodeLogger,
      useClass: NodeLogger,
    });
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

  async start(server: http.Server | https.Server | net.Server, serviceHandler?: (serviceCenter: RPCServiceCenter) => void) {

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
      console.log('process exit');
    });
    // Handles `Ctrl+C`.
    process.on('SIGINT', async () => {
      console.log('process SIGINT');
      await this.onStop();
      process.exit(0);
    });
    // Handles `kill pid`.
    process.on('SIGTERM', async () => {
      console.log('process SIGTERM');
      await this.onStop();
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
