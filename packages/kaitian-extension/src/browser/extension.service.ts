import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  ExtensionService,
  ExtensionNodeServiceServerPath,
  IExtensionNodeService,
  IExtraMetaData,
  IExtensionMetaData,
  ExtensionCapabilityRegistry,
  LANGUAGE_BUNDLE_FIELD,
  IExtension,
  JSONType,
  EXTENSION_EXTEND_SERVICE_PREFIX,
  MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER,
  ExtraMetaData,
  IExtensionProps,
  IExtensionNodeClientService,
  WorkerHostAPIIdentifier,
  /*Extension*/
} from '../common';
import {
  MainThreadAPIIdentifier,
  VSCodeExtensionService,
  ExtHostAPIIdentifier,
  IMainThreadCommands,
} from '../common/vscode';

import {
  AppConfig,
  isElectronEnv,
  Emitter,
  IContextKeyService,
  CommandService,
  CommandRegistry,
  URI,
  EDITOR_COMMANDS,
  Deferred,
  STORAGE_NAMESPACE,
  StorageProvider,
  IStorage,
  electronEnv,
  IClientApp,
  ClientAppContribution,
  ContributionProvider,
  SlotLocation,
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import {Extension} from './extension';
import { createApiFactory as createVSCodeAPIFactory} from './vscode/api/main.thread.api.impl';
import { createExtensionLogFactory } from './extension-log';

import { WorkbenchEditorService } from '@ali/ide-editor';
import { ActivationEventService } from '@ali/ide-activation-event';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import {
  WSChanneHandler as IWSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';

import { VscodeCommands } from './vscode/commands';
import { UriComponents } from '../common/vscode/ext-types';

import { IThemeService, IIconService } from '@ali/ide-theme';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { MainThreadCommands } from './vscode/api/main.thread.commands';
import { IToolBarViewService, ToolBarPosition, IToolBarComponent } from '@ali/ide-toolbar/lib/browser';

const MOCK_CLIENT_ID = 'MOCK_CLIENT_ID';

function getAMDRequire() {
  if (isElectronEnv()) {
    return (global as any).amdLoader.require;
  } else {
    return (global as any).amdLoader.require;
  }
}

function getAMDDefine(): any {
  if (isElectronEnv()) {
    return (global as any).amdLoader.require.define;
  } else {
    return (global as any).amdLoader.define;
  }
}

@Injectable()
export class ExtensionServiceImpl implements ExtensionService {
  private extensionScanDir: string[] = [];
  private extenionCandidate: string[] = [];
  private extraMetadata: IExtraMetaData = {};
  private protocol: RPCProtocol;

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: IExtensionNodeClientService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  // @Autowired(WSChanneHandler)
  // private wsChannelHandler: WSChanneHandler;

  // @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(CommandRegistry)
  private commandRegistry: CommandRegistry;

  @Autowired()
  private activationEventService: ActivationEventService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  @Autowired(IExtensionStorageService)
  private extensionStorageService: IExtensionStorageService;

  @Autowired()
  private staticResourceService: StaticResourceService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  @Autowired(IIconService)
  private iconService: IIconService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  // @Autowired()
  // viewRegistry: ViewRegistry;
  @Autowired(IToolBarViewService)
  private toolBarViewService: IToolBarViewService;

  public extensionMap: Map<string, Extension> = new Map();

  public extensionComponentMap: Map<string, string[]> = new Map();

  private ready: Deferred<any> = new Deferred();

  private extensionMetaDataArr: IExtensionMetaData[];
  private vscodeAPIFactoryDisposer: () => void;

  private workerProtocol: RPCProtocol;

  public async activate(): Promise<void> {
    this.contextKeyService = this.injector.get(IContextKeyService);
    await this.initBaseData();
    // 前置 contribute 操作
    this.extensionMetaDataArr = await this.getAllExtensions();
    console.log('kaitian extensionMetaDataArr', this.extensionMetaDataArr);
    await this.initExtension();
    await this.enableExtensions();
    await this.themeService.applyTheme();
    await this.iconService.applyTheme();
    this.doActivate();
  }

  private async doActivate() {
    console.log('ExtensionServiceImpl active');
    await this.workspaceService.whenReady;
    await this.extensionStorageService.whenReady;
    console.log('ExtensionServiceImpl active 2');

    await this.registerVSCodeDependencyService();

    this.commandRegistry.registerCommand({
      id: 'ext.restart',
      label: '重启进程',
    }, {
      execute: async () => {
        console.log('插件进程开始重启');
        await this.restartProcess();
        console.log('插件进程重启结束');
      },
    });

    await this.initBrowserDependency();

    await this.startProcess(true);

    // this.ready.resolve();

  }
  get clientId() {
    let clientId;

    if (isElectronEnv()) {
      console.log('createExtProcess electronEnv.metadata.windowClientId', electronEnv.metadata.windowClientId);
      clientId = electronEnv.metadata.windowClientId;
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      clientId = WSChanneHandler.clientId;
    }

    return clientId;
  }

  private async restartProcess() {
    const clientId = this.clientId;
    await this.extensionNodeService.disposeClientExtProcess(clientId, false);

    await this.startProcess(false);
  }

  public async startProcess(init: boolean) {

    if (!init) {
      this.disposeExtensions();
      await this.initExtension();
      await this.enableExtensions();
      // await this.layoutContribute();
    }

    await this.createExtProcess();
    const proxy = this.protocol.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    await proxy.$initExtensions();

    if (init) {
      this.ready.resolve();
    }

    if (!init) {
      if ( this.activationEventService.activatedEventSet.size) {
        await Promise.all(Array.from(this.activationEventService.activatedEventSet.values()).map((event) => {
          console.log('fireEvent', 'event.topic', event.topic, 'event.data', event.data);
          return this.activationEventService.fireEvent(event.topic, event.data);
        }));
      }
    } else {
      await this.activationEventService.fireEvent('*');
    }
  }

  // private onSelectContributions(){
  //   const contributions = this.injector.get(ClientAppContribution).getContributions();
  //   for(let contribution of contributions){
  //     if(contribution.onReconnect){
  //       contribution.onReconnect(this)
  //     }
  //   }
  // }

  public async getAllExtensions(): Promise<IExtensionMetaData[]> {
    if (!this.extensionMetaDataArr) {
      const extensions = await this.extensionNodeService.getAllExtensions(this.extensionScanDir, this.extenionCandidate, this.extraMetadata);
      this.extensionMetaDataArr = extensions;
    }
    return this.extensionMetaDataArr;
  }

  public async getAllExtensionJson(): Promise<IExtensionProps[]> {
    await this.getAllExtensions();
    // await this.initExtension();
    return Array.from(this.extensionMap.values()).map((extension) => extension.toJSON());
  }

  public async getExtensionProps(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionProps | undefined> {
    const extensionMetaData = await this.extensionNodeService.getExtension(extensionPath, extraMetaData);
    if (extensionMetaData) {
      const extension = this.extensionMap.get(extensionPath);
      if (extension) {
        return {
          ...extension.toJSON(),
          extraMetadata: extensionMetaData.extraMetadata,
        };
      }
    }
  }

  private async checkExtensionEnable(extension: IExtensionMetaData): Promise<boolean> {
    const storage = await this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS);
    return storage.get(extension.extensionId) !== '0';
  }

  public async setExtensionEnable(extensionId: string, enable: boolean) {
    const storage = await this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS);
    storage.set(extensionId, enable ? '1' : '0');
  }

  private async initBrowserDependency() {
    getAMDDefine()('React', [] , () => {
      return React;
    });
    getAMDDefine()('ReactDOM', [] , () => {
      return ReactDOM;
    });
  }
  private async initBaseData() {
    if (this.appConfig.extensionDir) {
      this.extensionScanDir.push(this.appConfig.extensionDir);
    }
    if (this.appConfig.extenionCandidate) {
      this.extenionCandidate.push(this.appConfig.extenionCandidate);
    }
    this.extraMetadata[LANGUAGE_BUNDLE_FIELD] = './package.nls.json';
  }

  private async initExtension() {
    for (const extensionMetaData of this.extensionMetaDataArr) {
      const extension = this.injector.get(Extension, [
        extensionMetaData,
        this,
        // 检测插件是否启用
        await this.checkExtensionEnable(extensionMetaData),
        // 通过路径判决是否是内置插件
        extensionMetaData.realPath.startsWith(this.appConfig.extensionDir!),
      ]);

      this.extensionMap.set(extensionMetaData.path, extension);
    }

  }

  private async enableExtensions() {
    await Promise.all(Array.from(this.extensionMap.values()).map((extension) => {
      return extension.enable();
    }));
  }

  // FIXME: 临时处理组件激活
  // private async layoutContribute() {
  //   console.log('this.viewRegistry.viewsMap.keys()', this.viewRegistry.viewsMap.keys());

  //   for (const containerId of this.viewRegistry.viewsMap.keys()) {
  //     const views = this.viewRegistry.viewsMap.get(containerId);
  //     const containerOption = this.viewRegistry.containerMap.get(containerId);
  //     if (views) {
  //       // 内置的container
  //       if (containerOption) {
  //         // 自定义viewContainer
  //         this.layoutService.registerTabbarComponent(views, containerOption, SlotLocation.left);
  //       }
  //     } else {
  //       console.warn('注册了一个没有view的viewContainer!');
  //     }
  //   }
  // }

  private async disposeExtensions() {
    this.extensionMap.forEach((extension) => {
      extension.dispose();
    });

    this.extensionMap = new Map();
    this.vscodeAPIFactoryDisposer();

    this.extensionComponentMap.forEach((componentIdArr) => {
      for (const componentId of componentIdArr) {
        const componentHandler = this.layoutService.getTabbarHandler(componentId);

        if (componentHandler) {
          componentHandler.dispose();
        }
      }
    });
  }

  public async createExtProcess() {

    let clientId;

    if (isElectronEnv()) {
      clientId = electronEnv.metadata.windowClientId;
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      clientId = WSChanneHandler.clientId;
    }
    // await this.extensionNodeService.createProcess();

    await this.extensionNodeService.createProcess(clientId);

    await this.initExtProtocol();
    this.initWorkerHost();

    this.setVSCodeMainThreadAPI();

    // await this.extensionNodeService.resolveConnection();
    this.setExtensionLogThread();
    // await this.extensionNodeService.resolveProcessInit(clientId);

  }
  private async initWorkerHost() {
    // @ts-ignore
    const workerUrl = this.appConfig.extWorkerHost;
    if (!workerUrl) {
      return;
    }

    console.log('workerUrl', workerUrl);

    const extendWorkerHost = new Worker(workerUrl);
    const onMessageEmitter = new Emitter<string>();
    const onMessage = onMessageEmitter.event;

    extendWorkerHost.onmessage = (e) => {
      onMessageEmitter.fire(e.data);
    };

    const mainThreadWorkerProtocol = new RPCProtocol({
      onMessage,
      send: extendWorkerHost.postMessage.bind(extendWorkerHost),
    });

    this.workerProtocol = mainThreadWorkerProtocol;
    const workerProxy = this.workerProtocol.getProxy(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
    await workerProxy.$initExtensions();
  }

  private async initExtProtocol() {
    const mainThreadCenter = new RPCServiceCenter();

    if (isElectronEnv()) {
      const connectPath = await this.extensionNodeService.getElectronMainThreadListenPath(electronEnv.metadata.windowClientId);
      console.log('electron initExtProtocol connectPath', connectPath);
      const connection = (window as any).createNetConnection(connectPath);
      mainThreadCenter.setConnection(createSocketConnection(connection));
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      const channel = await WSChanneHandler.openChannel('ExtMainThreadConnection');
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

    // 重启/重连时直接覆盖前一个连接
    this.protocol = mainThreadProtocol;
  }

  public setVSCodeMainThreadAPI() {
    this.vscodeAPIFactoryDisposer = createVSCodeAPIFactory(this.protocol, this.injector, this);

    // 注册 worker 环境的响应 API
    if (this.workerProtocol) {
      this.workerProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionServie, this);
      this.workerProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, this.injector.get(MainThreadCommands, [this.workerProtocol]));
    }
  }

  public setExtensionLogThread() {
    createExtensionLogFactory(this.protocol, this.injector);
  }

  public async activeExtension(extension: IExtension) {

    // await this.ready.promise
    const proxy = await this.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    await proxy.$activateExtension(extension.id);

    const { extendConfig } = extension;

    if (extendConfig.worker && extendConfig.worker.main) {
      const workerProxy = this.workerProtocol.getProxy(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
      await workerProxy.$activateExtension(extension.id);
    }

    // TODO: 存储插件与 component 的关系，用于 dispose
    if (extendConfig.browser && extendConfig.browser.main) {
      const browserScriptURI = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()));
      const browserExported = await this.loadBrowser(browserScriptURI.toString());

      this.registerBrowserComponent(browserExported, extension);
    }

  }

  /**
   * 创建前台 UI 消息链路
   * @param extension
   * @param componentId
   */
  private createExtensionExtendProtocol(extension: IExtension, componentId: string) {
    const {id: extensionId} = extension;
    const rpcProtocol = this.protocol;

    const extendProtocol = new Proxy(rpcProtocol, {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        if (prop === 'getProxy') {
          return () => {
            const proxy = obj.getProxy({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}`} as ProxyIdentifier<any>);
            return new Proxy(proxy, {
              get: (obj, prop) => {
                if (typeof prop === 'symbol') {
                  return obj[prop];
                }

                return obj[`$${prop}`];
              },
            });
          };
        } else if (prop === 'set') {
          const componentProxyIdentifier = {serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}:${componentId}`};

          return (componentService) => {
            const service = {};
            for (const key in componentService) {
              if (componentService.hasOwnProperty(key)) {
                service[`$${key}`] = componentService[key];
              }
            }

            console.log('componentProxyIdentifier', componentProxyIdentifier, 'service', service);

            return obj.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
          };
        }

      },
    });

    return extendProtocol;
  }
  private dollarProxy(proxy) {
    return new Proxy(proxy, {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        return obj[`$${prop}`];
      },
    });
  }
  private createExtensionExtendProtocol2(extension: IExtension, componentId: string) {
    const {id: extensionId} = extension;
    const protocol = this.protocol;
    const workerProtocol = this.workerProtocol;

    const extendProtocol = new Proxy(Object.create(null), {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        if (prop === 'getProxy') {
          return () => {
            let protocolProxy = protocol.getProxy({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}`} as ProxyIdentifier<any>);
            protocolProxy = this.dollarProxy(protocolProxy);
            let workerProtocolProxy;

            if (this.workerProtocol) {
              workerProtocolProxy = workerProtocol.getProxy({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}`} as ProxyIdentifier<any>);
              workerProtocolProxy = this.dollarProxy(workerProtocolProxy);
            }

            // TODO: 增加判断是否有对应环境的服务，没有的话做预防处理
            return {
              node: protocolProxy,
              worker: workerProtocolProxy,
            };

          };
        } else if (prop === 'set') {
          const componentProxyIdentifier = {serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}:${componentId}`};

          return (componentService) => {
            const service = {};
            for (const key in componentService) {
              if (componentService.hasOwnProperty(key)) {
                service[`$${key}`] = componentService[key];
              }
            }

            console.log('componentProxyIdentifier', componentProxyIdentifier, 'service', service);

            if (workerProtocol) {
              workerProtocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
            }
            return protocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
          };
        }
      },
    });

    return extendProtocol;
  }

  private registerBrowserComponent(browserExported: any, extension: IExtension) {
    if (browserExported.default) {
      browserExported = browserExported.default;
    }

    for (const pos in browserExported) {
      if (browserExported.hasOwnProperty(pos)) {
        const posComponent = browserExported[pos].component;
        if (pos === 'left' || pos === 'right' || pos === 'bottom') {
          for (let i = 0, len = posComponent.length; i < len; i++) {
            const component = posComponent[i];

            /*
            const extendProtocol = this.createExtensionExtendProtocol(extension, component.id);
            const extendService = extendProtocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER);
            this.layoutService.collectTabbarComponent(
              [{
                component: component.panel,
                id: `${extension.id}:${component.id}`,
              }],
              {
                iconClass: component.icon,
                initialProps: {
                  kaitianExtendService: extendService,
                  kaitianExtendSet: extendProtocol,
                },
                containerId: extension.id,
                title: component.title,
                activateKeyBinding: component.keyBinding,
              },
              pos,
            );
            */

            const extendProtocol = this.createExtensionExtendProtocol2(extension, component.id);
            const extendService = extendProtocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER);
            const componentId = this.layoutService.collectTabbarComponent(
              [{
                component: component.panel,
                id: `${extension.id}:${component.id}`,
              }],
              {
                iconClass: component.icon,
                initialProps: {
                  kaitianExtendService: extendService,
                  kaitianExtendSet: extendProtocol,
                },
                containerId: `${extension.id}:${component.id}`,
                activateKeyBinding: component.keyBinding,
                title: component.title,
              },
              pos,
            );

            if (!this.extensionComponentMap.has(extension.id)) {
              this.extensionComponentMap.set(extension.id, []);
            }

            const extensionComponentArr = this.extensionComponentMap.get(extension.id) as string[];
            extensionComponentArr.push(componentId);
            this.extensionComponentMap.set(extension.id, extensionComponentArr);
          }
        } else if (pos === 'toolBar') {
          for (let i = 0, len = posComponent.length; i < len; i += 1) {
            const component = posComponent[i];
            const extendProtocol = this.createExtensionExtendProtocol(extension, component.id);
            const extendService = extendProtocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER);
            this.toolBarViewService.registerToolBarElement({
              type: 'component',
              component: component.panel as React.FunctionComponent | React.ComponentClass,
              position: ToolBarPosition.LEFT,
              initialProps: {
                kaitianExtendService: extendService,
                kaitianExtendSet: extendProtocol,
              },
            } as IToolBarComponent);
          }
        }

      }
    }

  }

  private async loadBrowser(browserPath: string): Promise<any> {
    return await new Promise((resolve) => {
      console.log('extend browser load', browserPath);
      getAMDRequire()([browserPath], (exported) => {
        console.log('extend browser exported', exported);
        resolve(exported);
      });
    });
  }

  private registerVSCodeDependencyService() {
    // `listFocus` 为 vscode 旧版 api，已经废弃，默认设置为 true
    this.contextKeyService.createKey('listFocus', true);

    const workbenchEditorService: WorkbenchEditorService =  this.injector.get(WorkbenchEditorService);
    const commandService: CommandService =  this.injector.get(CommandService);
    const commandRegistry = this.commandRegistry;

    commandRegistry.beforeExecuteCommand(async (command, args) => {
      await this.activationEventService.fireEvent('onCommand', command);
      return args;
    });

    commandRegistry.registerCommand(VscodeCommands.SET_CONTEXT, {
      execute: (contextKey: any, contextValue: any) => {
        this.contextKeyService.createKey(String(contextKey), contextValue);
      },
    });

    commandRegistry.registerCommand(VscodeCommands.WORKBENCH_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.REVERT_AND_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_RIGHT);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_DOWN);
    commandRegistry.registerCommand(VscodeCommands.NEW_UNTITLED_FILE);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_ALL_EDITORS);
    commandRegistry.registerCommand(VscodeCommands.FILE_SAVE);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.SPLIT_EDITOR_ORTHOGONAL);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_LEFT);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_RIGHT);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_UP);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_DOWN);
    commandRegistry.registerCommand(VscodeCommands.NAVIGATE_NEXT);
    commandRegistry.registerCommand(VscodeCommands.PREVIOUS_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.PREVIOUS_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.NEXT_EDITOR);
    commandRegistry.registerCommand(VscodeCommands.NEXT_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.EVEN_EDITOR_WIDTH);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_OTHER_GROUPS);
    commandRegistry.registerCommand(VscodeCommands.LAST_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VscodeCommands.OPEN_EDITOR_AT_INDEX);
    commandRegistry.registerCommand(VscodeCommands.CLOSE_OTHER_EDITORS);
    commandRegistry.registerCommand(VscodeCommands.REVERT_FILES);

    commandRegistry.registerCommand(VscodeCommands.OPEN, {
      execute: (uriComponents: UriComponents) => {
        const uri = URI.from(uriComponents);
        workbenchEditorService.open(uri);
      },
    });

    commandRegistry.registerCommand(VscodeCommands.DIFF, {
      execute: (left: UriComponents, right: UriComponents, title: string, options: any) => {
        const original = URI.from(left);
        const modified = URI.from(right);
        commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
          original,
          modified,
          name: title,
        });
      },
    });
  }

  // remote call
  public async $getExtensions(): Promise<IExtensionProps[]> {
    return Array.from(this.extensionMap.values()).map((extension) => {
      if (
        extension.extendConfig &&
        extension.extendConfig.worker &&
        extension.extendConfig.worker.main
      ) {
        const workerScriptURI = this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extension.extendConfig.worker.main).toString()));
        const workerScriptPath = workerScriptURI.toString();

        return Object.assign({}, extension.toJSON(), {workerScriptPath});
      } else {
        return extension;
      }
    });
  }

  public async $activateExtension(extensionPath: string): Promise<void> {
    const extension = this.extensionMap.get(extensionPath);
    if (extension) {
      extension.activate();
    }
  }

  public async getProxy(identifier): Promise<any> {
    await this.ready.promise;
    return this.protocol.getProxy(identifier);
  }

  public async processNotExist(clientId: string) {
    const msg = await this.dialogService.info('当前插件进程已失效，插件逻辑已失效，刷新重启后可恢复，是否刷新重启，或使用剩余功能?', ['使用剩余功能', '刷新重启']);

    if (msg === '刷新重启') {
      this.clientApp.fireOnReload();
    }

  }

  public async processCrashRestart(clientId: string) {
    const msg = await this.messageService.info('插件进程异常退出，是否重启插件进程', ['是', '否']);
    if (msg === '是') {
      await this.startProcess(false);
    }
  }

}
