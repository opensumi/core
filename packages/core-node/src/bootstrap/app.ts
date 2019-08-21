import { Injector, ConstructorOf } from '@ali/common-di';
import * as Koa from 'koa';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { MaybePromise, ContributionProvider, getLogger, ILogger, Deferred, createContributionProvider } from '@ali/ide-core-common';
import { bindModuleBackService, createServerConnection2, createNetServerConnection, RPCServiceCenter } from '../connection';
import { NodeModule } from '../node-module';
import { WebSocketHandler } from '@ali/ide-connection/lib/node';
import { LogLevel, ILogServiceManage, ILogService, SupportLogNamespace } from '@ali/ide-core-common';

export type ModuleConstructor = ConstructorOf<NodeModule>;
export type ContributionConstructor = ConstructorOf<ServerAppContribution>;

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  injector?: Injector;
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

export interface IServerAppOpts extends Partial<AppConfig>  {
  modules?: ModuleConstructor[];
  contributions?: ContributionConstructor[];
  modulesInstances?: NodeModule[];
  webSocketHandler?: WebSocketHandler[];
  use?(middleware: Koa.Middleware<Koa.ParameterizedContext<any, {}>>): void;
}

export const ServerAppContribution = Symbol('ServerAppContribution');

export interface ServerAppContribution {
  initialize?(app: IServerApp): MaybePromise<void>;
  onStart?(app: IServerApp): MaybePromise<void>;
  onStop?(app: IServerApp): void;
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
    };
    this.bindProcessHandler();
    this.initBaseProvider(opts);
    this.createNodeModules(opts.modules, opts.modulesInstances);
    this.logger = this.injector.get(ILogServiceManage).getLogger(SupportLogNamespace.App);
    this.contributionsProvider = this.injector.get(ServerAppContribution);
    this.initializeContribution();
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
  }

  private initializeContribution() {
    for (const contribution of this.contributions) {
      if (contribution.initialize) {
        try {
          contribution.initialize(this);
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

    let serviceCenter;

    if (serviceHandler) {
      serviceCenter = new RPCServiceCenter();
      serviceHandler(serviceCenter);
    } else {
      if (server instanceof http.Server || server instanceof https.Server) {
      // 创建 websocket 通道
        serviceCenter = createServerConnection2(server, this.webSocketHandler);
      } else if (server instanceof net.Server) {
        serviceCenter = createNetServerConnection(server);
      }
    }

    bindModuleBackService(this.injector, this.modulesInstances, serviceCenter);

    await this.startContribution();

  }

  private onStop() {
    for (const contrib of this.contributions) {
      if (contrib.onStop) {
        try {
          contrib.onStop(this);
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
    process.on('exit', () => this.onStop());
    // Handles `Ctrl+C`.
    process.on('SIGINT', () => process.exit(0));
    // Handles `kill pid`.
    process.on('SIGTERM', () => process.exit(0));
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
