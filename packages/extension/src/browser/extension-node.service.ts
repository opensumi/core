import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IRPCProtocol, SumiConnectionMultiplexer } from '@opensumi/ide-connection';
import { WSChannelHandler as IWSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';
import {
  AppConfig,
  Deferred,
  IApplicationService,
  IDisposable,
  IExtensionProps,
  ILogger,
  toDisposable,
} from '@opensumi/ide-core-browser';

import {
  CONNECTION_HANDLE_BETWEEN_EXTENSION_AND_MAIN_THREAD,
  ExtensionNodeServiceServerPath,
  IExtension,
  IExtensionHostService,
  IExtensionNodeClientService,
} from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import { AbstractNodeExtProcessService } from '../common/extension.service';
import { ExtHostAPIIdentifier } from '../common/vscode';
import { knownProtocols } from '../common/vscode/protocols';

import { createSumiAPIFactory } from './sumi/main.thread.api.impl';
import { initNodeThreadAPIProxy } from './vscode/api/main.thread.api.impl';
import { initSharedAPIProxy } from './vscode/api/main.thread.api.shared-impl';

@Injectable()
export class NodeExtProcessService implements AbstractNodeExtProcessService<IExtensionHostService> {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  private _apiFactoryDisposables: IDisposable[] = [];

  public ready: Deferred<void> = new Deferred();
  private _extHostUpdated: Deferred<void> = new Deferred();

  private extensions: IExtension[] = [];
  public protocol: IRPCProtocol;

  public disposeApiFactory() {
    this._apiFactoryDisposables.forEach((disposable) => {
      disposable.dispose();
    });
    this._apiFactoryDisposables = [];
  }

  public async disposeProcess() {
    this.disposeApiFactory();
    await this.extensionNodeClient.disposeClientExtProcess(this.clientId, false);
  }

  public async activate(): Promise<IRPCProtocol> {
    await this.createExtProcess();
    if (this.protocol) {
      this.ready.resolve();
      this.logger.verbose('init node thread api proxy', this.protocol);
      await this.createBrowserMainThreadAPI(this.protocol);

      const proxy = await this.getProxy();
      await proxy.$updateExtHostData();
      this._extHostUpdated.resolve();
    }

    return this.protocol;
  }

  public async activeExtension(extension: IExtension, isWebExtension: boolean): Promise<void> {
    if (!this.appConfig.noExtHost && !isWebExtension) {
      // 只有当 proxy.$updateExtHostData 调用之后才可以开始激活插件
      await this._extHostUpdated.promise;
      const proxy = await this.getProxy();
      await proxy.$activateExtension(extension.id);
    }
  }

  public async updateExtensionData(extensions: IExtension[]): Promise<void> {
    this.extensions = extensions;
    if (this.protocol) {
      const proxy: IExtensionHostService = await this.getProxy();
      // 同步 host 进程中的 extension 列表
      await proxy.$updateExtHostData();
      // 发送 extension 变化
      proxy.$fireChangeEvent();
    }
  }

  public getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((n) => n.id === extensionId);
  }

  // 以下两者是给插件进程调用的 rpc call
  public async $activateExtension(extensionPath: string): Promise<void> {
    const extension = this.extensions.find((n) => n.path === extensionPath);
    if (extension) {
      await extension.activate();
    }
  }

  public async $getExtensions(): Promise<IExtensionProps[]> {
    return this.extensions.map((n) => n.toJSON());
  }

  public async getProxy(): Promise<IExtensionHostService> {
    await this.ready.promise;
    return this.protocol.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
  }

  private async createBrowserMainThreadAPI(protocol: IRPCProtocol) {
    const apiProxy = initSharedAPIProxy(this.protocol, this.injector);
    await apiProxy.setup();
    this._apiFactoryDisposables.push(
      apiProxy,
      toDisposable(initNodeThreadAPIProxy(protocol, this.injector, this)),
      toDisposable(createSumiAPIFactory(protocol, this.injector)),
    );
  }

  public async getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    const proxy = await this.getProxy();
    return await proxy.$getActivatedExtensions();
  }

  private get clientId() {
    return this.applicationService.clientId;
  }

  private async createExtProcess() {
    await this.extensionNodeClient.createProcess(this.clientId, {
      enableDebugExtensionHost: this.appConfig.enableDebugExtensionHost,
      inspectExtensionHost: this.appConfig.inspectExtensionHost,
      extensionConnectOption: this.appConfig.extensionConnectOption,
    });

    await this.initExtProtocol();
  }

  connection: BaseConnection<Uint8Array>;

  /**
   * 这个 protocol 需要每次都重新创建，因为服务端是会在该 channel 连上后才开始进行插件进程相关的逻辑的
   */
  private async initExtProtocol() {
    const channelHandler = this.injector.get(IWSChannelHandler);
    const channel = await channelHandler.openChannel(CONNECTION_HANDLE_BETWEEN_EXTENSION_AND_MAIN_THREAD);

    this.connection = channel.createConnection();

    this.protocol = new SumiConnectionMultiplexer(this.connection, {
      timeout: this.appConfig.rpcMessageTimeout,
      name: 'node-ext-host',
      knownProtocols,
    });
  }
}
