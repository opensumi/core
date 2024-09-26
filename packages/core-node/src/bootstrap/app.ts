import http from 'http';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';

import Koa from 'koa';

import { Injector } from '@opensumi/di';
import { injectConnectionProviders } from '@opensumi/ide-connection/lib/common/server-handler';
import { WebSocketHandler } from '@opensumi/ide-connection/lib/node';
import {
  ContributionProvider,
  ILogService,
  ILogServiceManager,
  StoragePaths,
  SupportLogNamespace,
  createContributionProvider,
  getDebugLogger,
  getModuleDependencies,
  injectGDataStores,
  isWindows,
} from '@opensumi/ide-core-common';
import { DEFAULT_ALIPAY_CLOUD_REGISTRY } from '@opensumi/ide-core-common/lib/const';
import { suppressNodeJSEpipeError } from '@opensumi/ide-core-common/lib/node';

import { RPCServiceCenter, createNetServerConnection, createServerConnection2 } from '../connection';
import { NodeModule } from '../node-module';
import { AppConfig, IServerApp, IServerAppOpts, ModuleConstructor, ServerAppContribution } from '../types';

import { injectInnerProviders } from './inner-providers';

export class ServerApp implements IServerApp {
  private _injector: Injector;

  private config: IServerAppOpts;

  private logger: Pick<ILogService, 'log' | 'error'> = getDebugLogger();

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
  constructor(private opts: IServerAppOpts) {
    this._injector = opts.injector || new Injector();
    this.webSocketHandler = opts.webSocketHandler || [];
    // 使用外部传入的中间件
    this.use = opts.use || (() => null);
    this.config = {
      ...opts,
      injector: this.injector,
      marketplace: Object.assign(
        {
          endpoint: DEFAULT_ALIPAY_CLOUD_REGISTRY.ENDPOINT,
          extensionDir: path.join(
            os.homedir(),
            ...(isWindows ? [StoragePaths.WINDOWS_APP_DATA_DIR, StoragePaths.WINDOWS_ROAMING_DIR] : ['']),
            StoragePaths.DEFAULT_STORAGE_DIR_NAME,
            StoragePaths.MARKETPLACE_DIR,
          ),
          showBuiltinExtensions: false,
          accountId: DEFAULT_ALIPAY_CLOUD_REGISTRY.ACCOUNT_ID,
          masterKey: DEFAULT_ALIPAY_CLOUD_REGISTRY.MASTER_KEY,
          ignoreId: [],
        },
        opts.marketplace,
      ),
      extHost: process.env.EXTENSION_HOST_ENTRY || opts.extHost,
      rpcMessageTimeout: opts.rpcMessageTimeout || -1,
    };
    this.bindProcessHandler();
    this.initBaseProvider();
    this.createNodeModules(opts.modules, opts.modulesInstances);
    this.logger = this.injector.get(ILogServiceManager).getLogger(SupportLogNamespace.App);
    this.contributionsProvider = this.injector.get(ServerAppContribution);
  }

  get injector() {
    return this._injector;
  }

  /**
   * 将被依赖但未被加入modules的模块加入到待加载模块最后
   */
  public resolveModuleDeps(moduleConstructor: ModuleConstructor, modules: any[]) {
    const dependencies = getModuleDependencies(moduleConstructor);
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

  private initBaseProvider() {
    // 创建 contributionsProvider
    createContributionProvider(this.injector, ServerAppContribution);

    this.injector.addProviders({
      token: AppConfig,
      useValue: this.config,
    });
    injectInnerProviders(this.injector);
    injectConnectionProviders(this.injector);
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

    if (serviceHandler) {
      serviceHandler(new RPCServiceCenter());
    } else {
      if (server instanceof http.Server || server instanceof https.Server) {
        // 创建 websocket 通道
        createServerConnection2(server, this.injector, this.modulesInstances, this.webSocketHandler, this.opts);
      } else if (server instanceof net.Server) {
        createNetServerConnection(server, this.injector, this.modulesInstances);
      }
    }

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
    suppressNodeJSEpipeError(process, (msg) => {
      this.logger.error(msg);
    });

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
    injectGDataStores(this.injector);

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
