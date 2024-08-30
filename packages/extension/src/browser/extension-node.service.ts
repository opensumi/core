import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IRPCProtocol, SumiConnectionMultiplexer, WSChannel, createExtMessageIO } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { BaseConnection } from '@opensumi/ide-connection/lib/common/connection';
import {
  AppConfig,
  ContributionProvider,
  Deferred,
  Disposable,
  DisposableStore,
  ExtHostSpawnOptions,
  IApplicationService,
  IExtensionProps,
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
import { IMainThreadExtenderService, MainThreadExtenderContribution } from '../common/main.thread.extender';
import { ExtHostAPIIdentifier } from '../common/vscode';
import { knownProtocols } from '../common/vscode/protocols';

import { createSumiAPIFactory } from './sumi/main.thread.api.impl';
import { initNodeThreadAPIProxy } from './vscode/api/main.thread.api.impl';
import { initSharedAPIProxy } from './vscode/api/main.thread.api.shared-impl';

@Injectable()
export class NodeExtProcessService implements AbstractNodeExtProcessService<IExtensionHostService> {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  @Autowired(IApplicationService)
  protected readonly applicationService: IApplicationService;

  @Autowired(WSChannelHandler)
  private readonly channelHandler: WSChannelHandler;

  @Autowired(IMainThreadExtenderService)
  private readonly mainThreadExtenderService: IMainThreadExtenderService;

  @Autowired(MainThreadExtenderContribution)
  private readonly mainThreadExtenderContributionProvider: ContributionProvider<MainThreadExtenderContribution>;

  private _apiFactoryDisposables = new DisposableStore();

  public ready: Deferred<void> = new Deferred();
  private _extHostUpdated: Deferred<void> = new Deferred();

  private extensions: IExtension[] = [];
  public protocol: IRPCProtocol;

  public disposeApiFactory() {
    this._apiFactoryDisposables.clear();
  }

  public async disposeProcess() {
    this.disposeApiFactory();
    await this.extensionNodeClient.disposeClientExtProcess(this.clientId, false);
  }

  public async activate(): Promise<IRPCProtocol> {
    await this.createExtProcess();
    if (this.protocol) {
      this.ready.resolve();
      await this.createBrowserMainThreadAPI();

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

  private async createBrowserMainThreadAPI() {
    const apiProxy = initSharedAPIProxy(this.protocol, this.injector);
    this._apiFactoryDisposables.add(apiProxy);
    this._apiFactoryDisposables.add(toDisposable(initNodeThreadAPIProxy(this.protocol, this.injector, this)));
    this._apiFactoryDisposables.add(toDisposable(createSumiAPIFactory(this.protocol, this.injector)));
    this._apiFactoryDisposables.add(this.createExternalSumiAPIFactory());
    await apiProxy.setup();
  }

  getSpawnOptions(): ExtHostSpawnOptions {
    return {};
  }

  /**
   * register external main thread class
   * @returns disposer
   */
  private createExternalSumiAPIFactory() {
    const disposer = new Disposable();
    // register main thread extender contribution
    const contributions = this.mainThreadExtenderContributionProvider.getContributions();
    for (const contribution of contributions) {
      contribution.registerMainThreadExtender(this.mainThreadExtenderService);
    }
    // instantiate this MainThreadExtenderClass
    const extenders = this.mainThreadExtenderService.getMainThreadExtenders();
    for (const extender of extenders) {
      const service = this.injector.get(extender.serviceClass, [this.protocol]);
      this.protocol.set(extender.identifier, service);
      disposer.addDispose(service);
    }
    return disposer;
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
      extHostSpawnOptions: this.getSpawnOptions(),
    });

    await this.initExtProtocol();
  }

  connection: BaseConnection<Uint8Array>;
  channel: WSChannel;

  /**
   * 这个 protocol 需要每次都重新创建，因为服务端是会在该 channel 连上后才开始进行插件进程相关的逻辑的
   */
  private async initExtProtocol() {
    if (this.channel) {
      this.channel.dispose();
    }
    if (this.protocol) {
      (this.protocol as SumiConnectionMultiplexer).dispose?.();
    }

    this.channel = await this.channelHandler.openChannel(CONNECTION_HANDLE_BETWEEN_EXTENSION_AND_MAIN_THREAD);
    this.connection = this.channel.createConnection();

    this.protocol = new SumiConnectionMultiplexer(this.connection, {
      timeout: this.appConfig.rpcMessageTimeout,
      name: 'node-ext-host',
      io: createExtMessageIO(knownProtocols),
    });
  }
}
