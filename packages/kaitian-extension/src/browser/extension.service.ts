import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ExtensionService,
         ExtensionNodeServiceServerPath,
         ExtensionNodeService,
         IExtraMetaData,
         IExtensionMetaData,
         ExtensionCapabilityRegistry,
         LANGUAGE_BUNDLE_FIELD,
         /*Extension*/
        } from '../common';
import {
  MainThreadAPIIdentifier,
  VSCodeExtensionService,
} from '../common/vscode';

import { AppConfig, isElectronEnv, Emitter } from '@ali/ide-core-browser';
import {Extension} from './extension';
import * as cp from 'child_process';

import {
  WSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';

const MOCK_CLIENT_ID = 'MOCK_CLIENT_ID';

@Injectable()
export class ExtensionServiceImpl implements ExtensionService {
  private extensionScanDir: string[] = [];
  private extenionCandidate: string[] = [];
  private extraMetadata: IExtraMetaData = {};
  private protocol: RPCProtocol;

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: ExtensionNodeService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(WSChanneHandler)
  private wsChannelHandler: WSChanneHandler;

  public extensionMap: Map<string, Extension> = new Map();

  // TODO: 绑定 clientID
  public async activate(): Promise<void> {
    console.log('ExtensionServiceImpl active');
    await this.initBaseData();
    const extensionMetaDataArr = await this.getAllExtensions();
    console.log('kaitian extensionMetaDataArr', extensionMetaDataArr);

    await this.initExtension(extensionMetaDataArr);
    await this.createExtProcess();

  }

  public async getAllExtensions(): Promise<IExtensionMetaData[]> {
    return await this.extensionNodeService.getAllExtensions(this.extensionScanDir, this.extenionCandidate, this.extraMetadata);
  }

  private async initBaseData() {
    if (this.appConfig.extensionDir) {
      this.extensionScanDir.push(this.appConfig.extensionDir);
    }
    this.extraMetadata[LANGUAGE_BUNDLE_FIELD] = './package.nls.json';
  }

  private async initExtension(extensionMetaDataArr: IExtensionMetaData[]) {
    for (const extensionMetaData of extensionMetaDataArr) {
      const extension = this.injector.get(Extension, [
        extensionMetaData,
      ]);
      console.log('extensionMetaData', extensionMetaData);

      this.extensionMap.set(extensionMetaData.path, extension);
    }

    await Promise.all(Array.from(this.extensionMap.values()).map((extension) => {
      return extension.enable();
    }));
  }

  public async createExtProcess() {
    // TODO: 进程创建单独管理，用于重连获取原有进程句柄
    await this.extensionNodeService.createProcess();
    await this.initExtProtocol();
    await this.extensionNodeService.resolveConnection();
    await this.extensionNodeService.resolveProcessInit();
  }

  private async initExtProtocol() {
    const mainThreadCenter = new RPCServiceCenter();

    if (isElectronEnv()) {
      const connectPath = await this.extensionNodeService.getElectronMainThreadListenPath(MOCK_CLIENT_ID);
      const connection = (window as any).createNetConnection(connectPath);
      mainThreadCenter.setConnection(createSocketConnection(connection));
    } else {
      const channel = await this.wsChannelHandler.openChannel(MOCK_CLIENT_ID);
      mainThreadCenter.setConnection(createWebSocketConnection(channel));
    }

    const {getRPCService} = initRPCService(mainThreadCenter);

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

    this.protocol = mainThreadProtocol;
    this.protocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, this);
  }

  public activeExtension(extension: IExtensionMetaData) {
    // await this.ready.promise

  }

  // remote call
  public async $getExtensions(): Promise<Extension[]> {
    return Array.from(this.extensionMap.values());
  }

}
