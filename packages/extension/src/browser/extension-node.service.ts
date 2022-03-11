import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  initRPCService,
  IRPCProtocol,
  RPCProtocol,
  RPCServiceCenter,
  createWebSocketConnection,
} from '@opensumi/ide-connection';
import { WSChannelHandler as IWSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import {
  AppConfig,
  Deferred,
  electronEnv,
  Emitter,
  IExtensionProps,
  ILogger,
  IDisposable,
  toDisposable,
} from '@opensumi/ide-core-browser';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import {
  ExtensionNodeServiceServerPath,
  IExtension,
  IExtensionHostService,
  IExtensionNodeClientService,
} from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import { AbstractNodeExtProcessService } from '../common/extension.service';
import { ExtHostAPIIdentifier } from '../common/vscode';

import { createSumiApiFactory } from './sumi/main.thread.api.impl';
import { createApiFactory as createVSCodeAPIFactory } from './vscode/api/main.thread.api.impl';

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
    this.protocol = await this.createExtProcess();
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
    this._apiFactoryDisposables.push(
      toDisposable(await createVSCodeAPIFactory(protocol, this.injector, this)),
      toDisposable(createSumiApiFactory(protocol, this.injector)),
    );
  }

  public async getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    const proxy = await this.getProxy();
    return await proxy.$getActivatedExtensions();
  }

  private get clientId() {
    let clientId: string;

    if (this.appConfig.isElectronRenderer && !this.appConfig.isRemote) {
      this.logger.verbose('createExtProcess electronEnv.metadata.windowClientId', electronEnv.metadata.windowClientId);
      clientId = electronEnv.metadata.windowClientId;
    } else {
      const WSChannelHandler = this.injector.get(IWSChannelHandler);
      clientId = WSChannelHandler.clientId;
    }

    return clientId;
  }

  private async createExtProcess() {
    await this.extensionNodeClient.createProcess(this.clientId, {
      enableDebugExtensionHost: this.appConfig.enableDebugExtensionHost,
      extensionConnectOption: this.appConfig.extensionConnectOption,
    });

    return this.initExtProtocol();
  }

  private async initExtProtocol() {
    const mainThreadCenter = new RPCServiceCenter();

    // Electron 环境下，未指定 isRemote 时默认使用本地连接
    // 注意，这里要使用 node 端的 createSocketConnection
    // 否则使用 WebSocket 连接
    if (this.appConfig.isElectronRenderer && !this.appConfig.isRemote) {
      const connectPath = await this.extensionNodeClient.getElectronMainThreadListenPath(
        electronEnv.metadata.windowClientId,
      );
      this.logger.verbose('electron initExtProtocol connectPath', connectPath);
      let connection: MessageConnection;
      if ((window as any).getMessageConnection) {
        connection = (window as any).getMessageConnection();
      } else {
        // eslint-disable-next-line import/no-restricted-paths
        const { createSocketConnection } = require('@opensumi/ide-connection/lib/node');
        const socket = (window as any).createNetConnection(connectPath);
        connection = createSocketConnection(socket);
      }
      mainThreadCenter.setConnection(connection);
    } else {
      const WSChannelHandler = this.injector.get(IWSChannelHandler);
      const channel = await WSChannelHandler.openChannel('ExtMainThreadConnection');
      mainThreadCenter.setConnection(createWebSocketConnection(channel));
    }

    const { getRPCService } = initRPCService<{
      onMessage: (msg: string) => void;
    }>(mainThreadCenter);

    const service = getRPCService('ExtProtocol');
    const onMessageEmitter = new Emitter<string>();
    service.on('onMessage', (msg) => {
      onMessageEmitter.fire(msg);
    });
    const onMessage = onMessageEmitter.event;
    const send = service.onMessage;

    const mainThreadProtocol = new RPCProtocol({
      onMessage,
      send,
    });

    // 重启/重连时直接覆盖前一个连接
    return mainThreadProtocol;
  }
}
