import { Injector, ConstructorOf } from '@ali/common-di';
import * as Koa from 'koa';
import * as http from 'http';
import * as https from 'https';
import { MaybePromise, ContributionProvider, getLogger, ILogger, Deferred, createContributionProvider } from '@ali/ide-core-common';
import { createServerConnection } from '../connection';
import { NodeModule } from '../node-module';
import { WebSocketHandler } from '@ali/ide-connection';

export type ModuleConstructor = ConstructorOf<NodeModule>;
export type ContributionConstructor = ConstructorOf<ServerAppContribution>;

export interface IServerAppOpts {
  app?: Koa;
  modules?: ModuleConstructor[];
  port?: number;
  injector?: Injector;
  contributions?: ContributionConstructor[];
  modulesInstances?: NodeModule[];
  webSocketHandler?: WebSocketHandler[];
}

export const ServerAppContribution = Symbol('ServerAppContribution');

export const ServerAppContributionProvider = Symbol('ServerAppContributionProvider');

export interface ServerAppContribution {
  initialize?(app: Koa): MaybePromise<void>;
  onStart?(app: Koa): MaybePromise<void>;
  onStop?(app: Koa): void;
}

export class ServerApp {

  protected injector: Injector;

  private app: Koa;

  protected port: number;

  logger: ILogger = getLogger();

  webSocketHandler: WebSocketHandler[];

  protected server: http.Server;

  protected modulesInstances: NodeModule[];

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
    this.app = opts.app || new Koa();
    this.port = opts.port || 8000;
    this.webSocketHandler = opts.webSocketHandler || [];

    this.bindProcessHandler();
    this.initBaseProvider(opts);
    this.createNodeModules(opts.modules, opts.modulesInstances);
    this.initFields();
  }

  get contributions(): ServerAppContribution[] {
    return this.contributionsProvider.getContributions();
  }

  private initBaseProvider(opts: IServerAppOpts) {
    // 创建 contributionsProvider
    createContributionProvider(this.injector, ServerAppContribution, ServerAppContributionProvider);
  }

  private async initializeContribution() {
    for (const contribution of this.contributions) {
      if (contribution.initialize) {
        try {
          await contribution.initialize(this.app);
        } catch (error) {
          this.logger.error('Could not initialize contribution', error);
        }
      }
    }
  }

  private initFields() {
    this.contributionsProvider = this.injector.get(ServerAppContributionProvider);
  }

  use(middleware: Koa.Middleware<Koa.ParameterizedContext<any, {}>>): void {
    this.app.use(middleware);
  }

  async start() {
    // 等待 contribution 初始化完毕
    await this.initializeContribution();
    const deferred = new Deferred<http.Server | https.Server>();
    this.server = http.createServer(this.app.callback());
    // 创建 websocket 通道
    createServerConnection(this.injector, this.modulesInstances, this.server, this.webSocketHandler);
    this.server.on('error', (error) => {
      deferred.reject(error);
      // 下一个事件循环中退出，防止程序还未处理就退出
      setTimeout(process.exit, 0, 1);
    });

    // 不限制 WebSocket 的连接数
    this.server.setMaxListeners(0);

    this.server.listen(this.port, async () => {
      for (const contrib of this.contributions) {
        if (contrib.onStart) {
          try {
            await contrib.onStart(this.app);
          } catch (error) {
            this.logger.error('Could not start contribution', error);
          }
        }
      }
      this.logger.info(`server listen on port ${this.port}`);
      deferred.resolve(this.server);
    });

    return deferred.promise;
  }

  onStop() {
    for (const contrib of this.contributions) {
      if (contrib.onStop) {
        try {
          contrib.onStop(this.app);
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
  createNodeModules(Constructors: ModuleConstructor[] = [], modules: NodeModule[] = []) {
    const allModules = [...modules];
    for (const Constructor of Constructors) {
      allModules.push(this.injector.get(Constructor));
    }
    for (const instance of allModules) {
      if (instance.providers) {
        this.injector.addProviders(...instance.providers);
      }
    }
    this.modulesInstances = allModules;
  }

  getServer() {
    return this.server;
  }
}
