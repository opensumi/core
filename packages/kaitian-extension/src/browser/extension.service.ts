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
  /*Extension*/
} from '../common';
import {
  MainThreadAPIIdentifier,
  VSCodeExtensionService,
  ExtHostAPIIdentifier,
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
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import {Extension} from './extension';
import { createApiFactory as createVSCodeAPIFactory} from './vscode/api/main.thread.api.impl';

import { WorkbenchEditorService } from '@ali/ide-editor';
import { ActivationEventService } from '@ali/ide-activation-event';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import {
  WSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';

import { VscodeCommands } from './vscode/commands';
import { UriComponents } from '../common/vscode/ext-types';

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
  private extensionNodeService: IExtensionNodeService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(WSChanneHandler)
  private wsChannelHandler: WSChanneHandler;

  @Autowired(IContextKeyService)
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

  public extensionMap: Map<string, Extension> = new Map();

  private ready: Deferred<any> = new Deferred();

  // TODO: 绑定 clientID
  public async activate(): Promise<void> {
    console.log('ExtensionServiceImpl active');
    await this.workspaceService.whenReady;
    await this.extensionStorageService.whenReady;
    await this.registerVSCodeDependencyService();
    await this.initBrowserDependency();
    await this.initBaseData();
    const extensionMetaDataArr = await this.getAllExtensions();
    console.log('kaitian extensionMetaDataArr', extensionMetaDataArr);
    await this.initExtension(extensionMetaDataArr);
    await this.createExtProcess();
    this.ready.resolve();

    this.activationEventService.fireEvent('*');
  }

  public async getAllExtensions(): Promise<IExtensionMetaData[]> {
    return await this.extensionNodeService.getAllExtensions(this.extensionScanDir, this.extenionCandidate, this.extraMetadata);
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
    this.extraMetadata[LANGUAGE_BUNDLE_FIELD] = './package.nls.json';
  }

  private async initExtension(extensionMetaDataArr: IExtensionMetaData[]) {
    for (const extensionMetaData of extensionMetaDataArr) {
      const extension = this.injector.get(Extension, [
        extensionMetaData,
        this,
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
    this.setVSCodeMainThreadAPI();
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
  }

  public setVSCodeMainThreadAPI() {
    createVSCodeAPIFactory(this.protocol, this.injector, this);
  }

  public async activeExtension(extension: IExtension) {

    // await this.ready.promise
    const proxy = await this.getProxy(ExtHostAPIIdentifier.ExtHostExtensionService);
    await proxy.$activateExtension(extension.id);

    const { extendConfig } = extension;
    if (extendConfig.browser && extendConfig.browser.main) {
      const browserScriptURI = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()));
      const browserExported = await this.loadBrowser(browserScriptURI.toString());
      this.registerBrowserComponent(browserExported, extension);
    }
  }

  private createExtensionExtendProtocol(extension: IExtension, componentId: string) {
    const {id: extentionId} = extension;
    const rpcProtocol = this.protocol;

    const extendProtocol = new Proxy(rpcProtocol, {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        if (prop === 'getProxy') {
          return () => {
            const proxy = obj.getProxy({serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extentionId}`} as ProxyIdentifier<any>);
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
          const componentProxyIdentifier = {serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extentionId}:${componentId}`};

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

  private registerBrowserComponent(browserExported: any, extension: IExtension) {
    if (browserExported.default) {
      browserExported = browserExported.default;
    }

    for (const pos in browserExported) {
      if (browserExported.hasOwnProperty(pos)) {
        const posComponent = browserExported[pos].component;

        if (pos === 'left' || pos === 'right') {
          for (let i = 0, len = posComponent.length; i < len; i++) {
            const component = posComponent[i];
            const extendProtocol = this.createExtensionExtendProtocol(extension, component.id);
            const extendService = extendProtocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER);
            this.layoutService.registerTabbarComponent(
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
              },
              pos,
            );
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
        return workbenchEditorService.open(uri);
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
  public async $getExtensions(): Promise<Extension[]> {
    return Array.from(this.extensionMap.values());
  }

  public async getProxy(identifier): Promise<any> {
    await this.ready.promise;
    return this.protocol.getProxy(identifier);
  }

}
