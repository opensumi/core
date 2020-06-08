import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {
  ExtensionService,
  ExtensionNodeServiceServerPath,
  IExtraMetaData,
  IExtensionMetaData,
  LANGUAGE_BUNDLE_FIELD,
  IExtension,
  EXTENSION_EXTEND_SERVICE_PREFIX,
  MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER,
  ExtraMetaData,
  IExtensionProps,
  IExtensionNodeClientService,
  WorkerHostAPIIdentifier,
  ExtensionHostType,
  EXTENSION_ENABLE,
  IExtensionHostService,
  IExtensionWorkerHost,
  ChangeExtensionOptions,
} from '../common';
import {
  MainThreadAPIIdentifier,
  VSCodeExtensionService,
  ExtHostAPIIdentifier,
  IMainThreadCommands,
  isLanguagePackExtension,
  ViewColumn,
  TextDocumentShowOptions,
} from '../common/vscode';

import {
  AppConfig,
  isElectronEnv,
  Emitter,
  Event,
  IContextKeyService,
  CommandService,
  CommandRegistry,
  URI,
  EDITOR_COMMANDS,
  Deferred,
  STORAGE_NAMESPACE,
  StorageProvider,
  electronEnv,
  IClientApp,
  ILogger,
  getPreferenceLanguageId,
  isElectronRenderer,
  IDisposable,
  CorePreferences,
  ExtensionActivateEvent,
} from '@ali/ide-core-browser';
import { Path } from '@ali/ide-core-common/lib/path';
import { Extension } from './extension';
import { createApiFactory as createVSCodeAPIFactory } from './vscode/api/main.thread.api.impl';
import { createKaitianApiFactory } from './kaitian/main.thread.api.impl';
import { createExtensionLogFactory } from './extension-log';

import { WorkbenchEditorService, IResourceOpenOptions } from '@ali/ide-editor';
import { IActivationEventService } from './types';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import {
  WSChannelHandler as IWSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
} from '@ali/ide-connection';
import * as retargetEvents from 'react-shadow-dom-retarget-events';

import { VSCodeCommands } from './vscode/commands';
import { UriComponents } from '../common/vscode/ext-types';

import { IThemeService, IIconService } from '@ali/ide-theme';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { MainThreadCommands } from './vscode/api/main.thread.commands';
import { createBrowserApi } from './kaitian-browser';
import { EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ExtensionCandiDate, localize, OnEvent, WithEventBus } from '@ali/ide-core-common';
import { IKaitianBrowserContributions } from './kaitian-browser/types';
import { KaitianBrowserContributionRunner } from './kaitian-browser/contribution';
import { viewColumnToResourceOpenOptions } from '../common/vscode/converter';
import { getShadowRoot } from './shadowRoot';
import { createProxiedWindow, createProxiedDocument } from './proxies';
import { getAMDDefine, getMockAmdLoader, getAMDRequire, getWorkerBootstrapUrl } from './loader';
import { KtViewLocation } from './kaitian/contributes/browser-views';
import { ExtensionNoExportsView } from './components';

const LOAD_FAILED_CODE = 'load';

@Injectable()
export class ExtensionServiceImpl extends WithEventBus implements ExtensionService {

  private extensionScanDir: string[] = [];
  private extensionCandidate: string[] = [];
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

  @Autowired(IActivationEventService)
  private activationEventService: IActivationEventService;

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

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  private extensionCommands: Map<string, ExtensionHostType> = new Map();

  public extensionMap: Map<string, Extension> = new Map();

  public extensionComponentMap: Map<string, string[]> = new Map();

  private mainThreadCommands = new Map<ExtensionHostType, IMainThreadCommands>();

  private ready: Deferred<any> = new Deferred();

  // 针对 activationEvents 为 * 的插件
  eagerExtensionsActivated: Deferred<void> = new Deferred();

  private extensionMetaDataArr: IExtensionMetaData[];
  private vscodeAPIFactoryDisposer: () => void;
  private kaitianAPIFactoryDisposer: () => void;

  private workerProtocol: RPCProtocol | undefined;

  private _onDidExtensionActivated: Emitter<IExtensionProps> = new Emitter<IExtensionProps>();
  public onDidExtensionActivated: Event<IExtensionProps> = this._onDidExtensionActivated.event;
  private shadowRootBodyMap: Map<string, HTMLBodyElement> = new Map();
  private portalShadowRootMap: Map<string, ShadowRoot> = new Map();

  @OnEvent(ExtensionActivateEvent)
  onActivateExtension(e) {
    this.activationEventService.fireEvent(e.payload.topic, e.payload.data);
  }

  public async activate(): Promise<void> {
    this.contextKeyService = this.injector.get(IContextKeyService);
    await this.initBaseData();
    // 前置 contribute 操作
    this.extensionMetaDataArr = await this.getAllExtensions();
    this.logger.verbose('kaitian extensionMetaDataArr', this.extensionMetaDataArr);
    await this.initExtension();
    await this.enableAvailableExtensions();
    await this.themeService.applyTheme();
    await this.iconService.applyTheme();
    this.doActivate();
  }

  private async doActivate() {
    this.logger.verbose('ExtensionServiceImpl active');
    await this.workspaceService.whenReady;
    await this.extensionStorageService.whenReady;
    this.logger.verbose('ExtensionServiceImpl active ready done');

    await this.registerVSCodeDependencyService();

    this.commandRegistry.registerCommand({
      id: 'ext.restart',
      label: '重启进程',
    }, {
      execute: async () => {
        this.logger.log('插件进程开始重启');
        await this.restartProcess();
        this.logger.log('插件进程重启结束');
      },
    });

    await this.initBrowserDependency();

    if (!this.appConfig.noExtHost) {
      await this.startProcess(true);
    }

    // this.ready.resolve();

  }

  public getExtensions() {
    return Array.from(this.extensionMap.values());
  }

  public async activateExtensionByExtPath(path: string) {
    const extension = this.extensionMap.get(path);
    if (extension) {
      return extension.activate();
    }
  }

  public registerPortalShadowRoot(extensionId: string): void {
    if (!this.portalShadowRootMap.has(extensionId)) {
      const portal = document.createElement('div');
      portal.setAttribute('id', `portal-shadow-root-${extensionId}`);
      document.body.appendChild(portal);
      const portalRoot = portal.attachShadow({ mode: 'open' });
      // const body = document.createElement('body');
      // portalRoot.appendChild(body);
      retargetEvents(portalRoot);
      this.portalShadowRootMap.set(extensionId, portalRoot);
    }
  }

  public getPortalShadowRoot(extensionId: string): ShadowRoot | undefined {
    return this.portalShadowRootMap.get(extensionId);
  }

  public registerShadowRootBody(id: string, body: HTMLBodyElement): void {
    if (!this.shadowRootBodyMap.has(id)) {
      this.shadowRootBodyMap.set(id, body);
    }
  }

  public getShadowRootBody(id: string): HTMLBodyElement | undefined {
    return this.shadowRootBodyMap.get(id);
  }

  public async postChangedExtension(options: ChangeExtensionOptions): Promise<void>;
  public async postChangedExtension(upgrade: boolean, path: string, oldExtensionPath?: string): Promise<void>;
  public async postChangedExtension(_upgrade: boolean | ChangeExtensionOptions, path?: string, _oldExtensionPath?: string) {
    const { upgrade, extensionPath, oldExtensionPath, isBuiltin } = typeof _upgrade === 'boolean' ? {
      upgrade: _upgrade,
      extensionPath: path!,
      oldExtensionPath: _oldExtensionPath,
      isBuiltin: false,
    } : _upgrade;
    const extensionMetadata = await this.extensionNodeService.getExtension(extensionPath, getPreferenceLanguageId(), {});
    if (extensionMetadata) {
      const extension = this.injector.get(Extension, [
        extensionMetadata,
        this,
        await this.checkExtensionEnable(extensionMetadata),
        isBuiltin || (this.appConfig.extensionDir ? extensionMetadata.realPath.startsWith(this.appConfig.extensionDir) : false),
        this._onDidExtensionActivated,
      ]);

      this.extensionMap.set(extensionPath, extension);

      if (upgrade) {
        const oldExtension = this.extensionMap.get(oldExtensionPath!);
        if (oldExtension) {
          oldExtension.dispose();
          this.extensionMap.delete(oldExtensionPath!);
        }
      }

      extension.enable();

      await this.updateExtensionHostData();

      await extension.contributeIfEnabled();
      const { packageJSON: { activationEvents = [] } } = extension;
      this.fireActivationEventsIfNeed(activationEvents);
    }
  }

  /**
   * 更新插件进程中插件的数据
   */
  private async updateExtensionHostData() {
    if (this.protocol) {
      const proxy: IExtensionHostService = this.protocol.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
      // 同步 host 进程中的 extension 列表
      await proxy.$initExtensions();
      // 发送 extension 变化
      proxy.$fireChangeEvent();
    }
  }

  public async postUninstallExtension(path: string) {
    const oldExtension = this.extensionMap.get(path);
    if (oldExtension) {
      oldExtension.dispose();
      this.extensionMap.delete(path);
    }
    await this.updateExtensionHostData();
  }

  private fireActivationEventsIfNeed(activationEvents: string[]) {
    if (activationEvents.find((event) => event === '*')) {
      this.activationEventService.fireEvent('*');
    }

    const _activationEvents = activationEvents.filter((event) => event !== '*');
    const shouldFireEvents = Array.from(
      this.activationEventService.activatedEventSet.values(),
    ).filter(({ topic, data }) => _activationEvents.find((_event) => _event === `${topic}:${data}`));

    for (const event of shouldFireEvents) {
      this.logger.verbose(`Fire activation event ${event.topic}:${event.data}`);
      this.activationEventService.fireEvent(event.topic, event.data);
    }
  }

  public async postDisableExtension(extensionPath: string) {
    const extension = this.extensionMap.get(extensionPath)!;
    extension.disable();
    await this.updateExtensionHostData();
  }

  public async postEnableExtension(extensionPath: string) {
    const extension = this.extensionMap.get(extensionPath)!;

    extension.enable();
    await extension.contributeIfEnabled();
    await this.updateExtensionHostData();
    if (extension.packageJSON.activationEvents) {
      this.fireActivationEventsIfNeed(extension.packageJSON.activationEvents);
    }
  }

  public async isExtensionRunning(extensionPath: string) {
    const extension = this.extensionMap.get(extensionPath);
    if (!extension) {
      return false;
    }

    return extension.activated;
  }

  get clientId() {
    let clientId;

    if (isElectronEnv()) {
      this.logger.verbose('createExtProcess electronEnv.metadata.windowClientId', electronEnv.metadata.windowClientId);
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
      await this.enableAvailableExtensions();
      // await this.layoutContribute();
    }

    await this.createExtProcess();

    const proxy = this.protocol.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
    await proxy.$initExtensions();

    if (this.workerProtocol) {
      const workerProxy = this.workerProtocol.getProxy(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
      await workerProxy.$initExtensions();
    }

    if (init) {
      this.ready.resolve();
    }

    if (!init) {
      if (this.activationEventService.activatedEventSet.size) {
        await Promise.all(Array.from(this.activationEventService.activatedEventSet.values()).map((event) => {
          this.logger.verbose('fireEvent', 'event.topic', event.topic, 'event.data', event.data);
          return this.activationEventService.fireEvent(event.topic, event.data);
        }));
      }
    }

    await this.activationEventService.fireEvent('*');
    this.eagerExtensionsActivated.resolve();
  }

  public async getAllExtensions(): Promise<IExtensionMetaData[]> {
    if (!this.extensionMetaDataArr) {
      const extensions = await this.extensionNodeService.getAllExtensions(this.extensionScanDir, this.extensionCandidate, getPreferenceLanguageId(), this.extraMetadata);
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
    const extensionMetaData = await this.extensionNodeService.getExtension(extensionPath, getPreferenceLanguageId(), extraMetaData);
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
    const [workspaceStorage, globalStorage] = await Promise.all([
      this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS),
      this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS),
    ]);
    // 全局默认为启用
    const globalEnableFlag = globalStorage.get<number>(extension.extensionId, EXTENSION_ENABLE.ENABLE);
    // 如果 workspace 未设置则读取全局配置
    return workspaceStorage.get<number>(extension.extensionId, globalEnableFlag) === EXTENSION_ENABLE.ENABLE;
  }

  private async initBrowserDependency() {
    getAMDDefine()('React', [], () => {
      return React;
    });
    getAMDDefine()('ReactDOM', [], () => {
      return ReactDOM;
    });
    getAMDDefine()('kaitian-browser', [], () => {
      return createBrowserApi(this.injector);
    });
  }
  private async initBaseData() {
    if (this.appConfig.extensionDir) {
      this.extensionScanDir.push(this.appConfig.extensionDir);
    }
    if (this.appConfig.extensionCandidate) {
      this.extensionCandidate = this.extensionCandidate.concat(this.appConfig.extensionCandidate.map((extension) => extension.path));
    }
    this.extraMetadata[LANGUAGE_BUNDLE_FIELD] = './package.nls.json';
  }

  /**
   * @param realPath extension path
   */
  private getExtensionCandidateByPath(realPath: string): ExtensionCandiDate | undefined {
    return this.appConfig.extensionCandidate && this.appConfig.extensionCandidate.find((extension) => extension.path === realPath);
  }

  private async initExtension() {
    for (const extensionMetaData of this.extensionMetaDataArr) {
      const extensionCandidate = this.getExtensionCandidateByPath(extensionMetaData.realPath);
      // 1. 通过路径判决是否是内置插件
      // 2. candidate 是否有  isBuiltin 标识符
      const isBuiltin = (this.appConfig.extensionDir ? extensionMetaData.realPath.startsWith(this.appConfig.extensionDir) : false) || (extensionCandidate ? extensionCandidate.isBuiltin : false);
      const extension = this.injector.get(Extension, [
        extensionMetaData,
        this,
        // 检测插件是否启用
        await this.checkExtensionEnable(extensionMetaData),
        isBuiltin,
        this._onDidExtensionActivated,
      ]);

      this.extensionMap.set(extensionMetaData.path, extension);
    }

  }

  private async enableAvailableExtensions() {
    const extensions = Array.from(this.extensionMap.values());
    const languagePackExtensions: Extension[] = [];
    const normalExtensions: Extension[] = [];

    for (const extension of extensions) {
      if (isLanguagePackExtension(extension.packageJSON)) {
        languagePackExtensions.push(extension);
        continue;
      } else {
        normalExtensions.push(extension);
        continue;
      }
    }

    // 优先执行 languagePack 的 contribute
    await Promise.all(languagePackExtensions.map((languagePack) => languagePack.contributeIfEnabled()));
    await Promise.all(normalExtensions.map((extension) => extension.contributeIfEnabled()));
  }

  private async disposeExtensions() {
    this.extensionMap.forEach((extension) => {
      extension.dispose();
    });

    this.extensionMap = new Map();
    this.vscodeAPIFactoryDisposer();
    this.kaitianAPIFactoryDisposer();

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

    await this.setVSCodeMainThreadAPI();

    // await this.extensionNodeService.resolveConnection();
    this.setExtensionLogThread();
    // await this.extensionNodeService.resolveProcessInit(clientId);

  }

  private async initWorkerHost() {
    // @ts-ignore
    const workerUrl = getWorkerBootstrapUrl(this.appConfig.extWorkerHost, 'extWorkerHost');
    if (!workerUrl) {
      return;
    }

    this.logger.verbose('workerUrl', workerUrl);

    const extendWorkerHost = new Worker(workerUrl, { name: 'KaitianWorkerExtensionHost' });
    const onMessageEmitter = new Emitter<string>();
    const onMessage = onMessageEmitter.event;

    extendWorkerHost.onmessage = (e) => {
      onMessageEmitter.fire(e.data);
    };

    const mainThreadWorkerProtocol = new RPCProtocol({
      onMessage,
      send: extendWorkerHost.postMessage.bind(extendWorkerHost),
    }, this.logger);

    this.workerProtocol = mainThreadWorkerProtocol;
  }

  private async initExtProtocol() {
    const mainThreadCenter = new RPCServiceCenter();

    if (isElectronEnv()) {
      const connectPath = await this.extensionNodeService.getElectronMainThreadListenPath(electronEnv.metadata.windowClientId);
      this.logger.verbose('electron initExtProtocol connectPath', connectPath);
      const connection = (window as any).createNetConnection(connectPath);
      mainThreadCenter.setConnection(createSocketConnection(connection));
    } else {
      const WSChanneHandler = this.injector.get(IWSChanneHandler);
      const channel = await WSChanneHandler.openChannel('ExtMainThreadConnection');
      mainThreadCenter.setConnection(createWebSocketConnection(channel));
    }

    const { getRPCService } = initRPCService(mainThreadCenter);

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

  public async setVSCodeMainThreadAPI() {
    this.vscodeAPIFactoryDisposer = await createVSCodeAPIFactory(this.protocol, this.injector, this);
    this.kaitianAPIFactoryDisposer = createKaitianApiFactory(this.protocol, this.injector);
    this.mainThreadCommands.set('node', this.protocol.get(MainThreadAPIIdentifier.MainThreadCommands));
    // 注册 worker 环境的响应 API
    if (this.workerProtocol) {
      this.workerProtocol.set<VSCodeExtensionService>(MainThreadAPIIdentifier.MainThreadExtensionService, this);
      this.workerProtocol.set<IMainThreadCommands>(MainThreadAPIIdentifier.MainThreadCommands, this.injector.get(MainThreadCommands, [this.workerProtocol]));
      this.mainThreadCommands.set('worker', this.workerProtocol.get(MainThreadAPIIdentifier.MainThreadCommands));
    }
  }

  async executeExtensionCommand(command: string, args: any[]): Promise<void> {
    const targetHost = this.getExtensionCommand(command);
    if (!targetHost) {
      throw new Error('No Command with id "' + command + '" is declared by extensions');
    }
    return this.mainThreadCommands.get(targetHost)!.$executeExtensionCommand(command, ...args);
  }
  declareExtensionCommand(command: string, targetHost: 'node' | 'worker' = 'node'): IDisposable {
    this.extensionCommands.set(command, targetHost);
    return {
      dispose: () => {
        this.extensionCommands.delete(command);
      },
    };
  }
  getExtensionCommand(command: string): 'node' | 'worker' | undefined {
    return this.extensionCommands.get(command);
  }

  public setExtensionLogThread() {
    createExtensionLogFactory(this.protocol, this.injector);

    if (this.workerProtocol) {
      createExtensionLogFactory(this.workerProtocol, this.injector);
    }
  }

  private normalizeDeprecatedViewsConfig(moduleExports: { [key: string]: any }, extension: IExtension, proxiedHead?: HTMLHeadElement) {
    if (this.appConfig.useExperimentalShadowDom) {
      return Object.keys(moduleExports).reduce((pre, cur) => {
        pre[cur] = {
          view: moduleExports[cur].component.map(({ panel, id, ...other }) => ({
            ...other,
            id,
            component: (props) => getShadowRoot(panel, extension, props, id, proxiedHead),
          })),
        };
        return pre;
      }, {});
    } else {
      const views = moduleExports.default ? moduleExports.default : moduleExports;
      return Object.keys(views).reduce((config, location) => {
        config[location] = {
          view: views[location].component.map(({ panel, ...other }) => ({
            ...other,
            component: panel,
          })),
        };
        return config;
      }, {});
    }
  }

  /**
   * @deprecated
   */
  private async activateExtensionByDeprecatedExtendConfig(extension: IExtension) {
    const { extendConfig } = extension;
    if (extendConfig.worker && extendConfig.worker.main) {
      if (!this.workerProtocol) {
        this.logger.warn('[Worker Host] extension worker host not yet initialized.');
        return;
      }
      const workerProxy = this.workerProtocol.getProxy<IExtensionWorkerHost>(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
      await workerProxy.$activateExtension(extension.id);
    }

    // TODO: 存储插件与 component 的关系，用于 dispose
    if (extendConfig.browser && extendConfig.browser.main) {
      this.logger.verbose(`register view by Deprecated config ${extension.id}`);
      const browserScriptURI = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()));
      try {
        const rawExtension = this.extensionMap.get(extension.path);
        if (this.appConfig.useExperimentalShadowDom) {
          this.registerPortalShadowRoot(extension.id);
          const { moduleExports, proxiedHead } = await this.loadBrowserScriptByMockLoader(browserScriptURI.toString(), extension.id, extension.extendConfig.browser.componentId);
          this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension, proxiedHead), rawExtension!);
        } else {
          const browserExported = await this.loadBrowser(browserScriptURI.toString());
          this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(browserExported, extension), rawExtension!);
        }
      } catch (err) {
        if (err.errorCode === LOAD_FAILED_CODE) {
          this.logger.error(`[Extension-Host] failed to load ${extension.name} - browser module, path: \n\n ${err.moduleId}`);
        } else {
          this.logger.error(err);
        }
      }
    }
  }

  /**
   * should replace view component
   */
  static tabBarLocation = ['left', 'right'];

  /**
   * @see [KtViewLocation](#KtViewLocation) view location
   */
  private getRegisterViewKind(location: KtViewLocation) {
    return ExtensionServiceImpl.tabBarLocation.includes(location) ? 'replace' : 'add';
  }

  private async getExtensionModuleExports(url: string, extensionId: string, viewsProxies: string[]): Promise<{ moduleExports: any; proxiedHead?: HTMLHeadElement }> {
    if (this.appConfig.useExperimentalShadowDom) {
      return await this.loadBrowserScriptByMockLoader2<IKaitianBrowserContributions>(url, extensionId, viewsProxies);
    }
    const moduleExports = await this.loadBrowser(url);
    return { moduleExports };
  }

  private getModuleExportsComponent(moduleExports: any, extension: IExtension, id: string, proxiedHead?: HTMLHeadElement) {
    if (!moduleExports[id]) {
      return () => ExtensionNoExportsView(extension.id, id);
    }
    if (this.appConfig.useExperimentalShadowDom) {
      return (props) => getShadowRoot(moduleExports[id], extension, props, id, proxiedHead);
    }
    return moduleExports[id];
  }

  public async activeExtension(extension: IExtension) {
    if (!this.appConfig.noExtHost) {
      const proxy = await this.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
      await proxy.$activateExtension(extension.id);
    }
    const { extendConfig, packageJSON } = extension;

    if (packageJSON.kaitianContributes && packageJSON.kaitianContributes.browserMain) {
      const browserModuleUri = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(packageJSON.kaitianContributes.browserMain).toString()));
      if (packageJSON.kaitianContributes.browserViews) {
        const { browserViews } = packageJSON.kaitianContributes;
        const { moduleExports, proxiedHead } = await this.getExtensionModuleExports(browserModuleUri.toString(), extension.id, packageJSON.kaitianContributes.viewsProxies);
        const viewsConfig = Object.keys(browserViews).reduce((config, location) => {
          config[location] = {
            type: this.getRegisterViewKind(location as KtViewLocation),
            view: browserViews[location].view.map(({ id, ...other }) => ({
              ...other,
              id,
              component: this.getModuleExportsComponent(moduleExports, extension, id, proxiedHead),
            })),
          };
          return config;
        }, {});
        this.registerBrowserComponent(viewsConfig, this.extensionMap.get(extension.path)!);
      }
      return;
    }

    if (extendConfig) {
      this.activateExtensionByDeprecatedExtendConfig(extension);
    }
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
    const { id: extensionId } = extension;
    const protocol = this.protocol;
    const workerProtocol = this.workerProtocol;

    const extendProtocol = new Proxy<{
      getProxy: (identifier: ProxyIdentifier<any>) => {
        node: any,
        worker: any,
      },
      set: <T>(identifier: ProxyIdentifier<T>, service: T) => void,
    }>(Object.create(null), {
      get: (obj, prop) => {
        if (typeof prop === 'symbol') {
          return obj[prop];
        }

        if (prop === 'getProxy') {
          return () => {
            let protocolProxy = protocol.getProxy({ serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}` } as ProxyIdentifier<any>);
            protocolProxy = this.dollarProxy(protocolProxy);
            let workerProtocolProxy;

            if (workerProtocol) {
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
          const componentProxyIdentifier = { serviceId: `${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}:${componentId}` };

          return (componentService) => {
            const service = {};
            for (const key in componentService) {
              if (componentService.hasOwnProperty(key)) {
                service[`$${key}`] = componentService[key];
              }
            }

            this.logger.log('componentProxyIdentifier', componentProxyIdentifier, 'service', service);

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

  private getExtensionExtendService(extension: IExtension, id: string) {
    const protocol = this.createExtensionExtendProtocol2(extension, id);
    this.logger.log(`bind extend service for ${extension.id}:${id}`);
    return {
      extendProtocol: protocol,
      extendService: protocol.getProxy(MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER),
    };
  }

  private registerBrowserComponent(browserExported: any, extension: Extension) {
    if (browserExported.default) {
      browserExported = browserExported.default;
    }
    const contribution: IKaitianBrowserContributions = browserExported;
    extension.addDispose(this.injector.get(KaitianBrowserContributionRunner, [extension, contribution]).run({
      getExtensionExtendService: this.getExtensionExtendService.bind(this),
    }));

  }

  private async loadBrowserScriptByMockLoader(browerPath: string, extensionId: string, componentIds: string[]): Promise<{ moduleExports: any, proxiedHead: HTMLHeadElement }> {
    const pendingFetch = await fetch(decodeURIComponent(browerPath));
    const { _module, _exports, _require } = getMockAmdLoader(this.injector, extensionId, componentIds);
    const _stylesCollection = [];
    const proxiedHead = document.createElement('head');
    const proxiedDocument = createProxiedDocument(proxiedHead);
    const proxiedWindow = createProxiedWindow(proxiedDocument, proxiedHead);

    const initFn = new Function('module', 'exports', 'require', 'styles', 'document', 'window', await pendingFetch.text());

    initFn(_module, _exports, _require, _stylesCollection, proxiedDocument, proxiedWindow);
    return {
      moduleExports: _module.exports.default,
      proxiedHead,
    };
  }

  private async loadBrowserScriptByMockLoader2<T>(browerPath: string, extensionId: string, componentIds: string[]): Promise<{ moduleExports: T, proxiedHead: HTMLHeadElement }> {
    const pendingFetch = await fetch(decodeURIComponent(browerPath));
    const { _module, _exports, _require } = getMockAmdLoader<T>(this.injector, extensionId, componentIds);
    const _stylesCollection = [];
    const proxiedHead = document.createElement('head');
    const proxiedDocument = createProxiedDocument(proxiedHead);
    const proxiedWindow = createProxiedWindow(proxiedDocument, proxiedHead);

    const initFn = new Function('module', 'exports', 'require', 'styles', 'document', 'window', await pendingFetch.text());

    initFn(_module, _exports, _require, _stylesCollection, proxiedDocument, proxiedWindow);
    return {
      // @ts-ignore
      moduleExports: _module.exports,
      proxiedHead,
    };
  }

  private async loadBrowser(browserPath: string): Promise<any> {
    return await new Promise((resolve, reject) => {
      this.logger.verbose('extend browser load', browserPath);
      if (isElectronRenderer()) {
        browserPath = decodeURIComponent(browserPath);
      }
      getAMDRequire()([browserPath], (exported) => {
        this.logger.verbose('extend browser exported', exported);
        resolve(exported);
      }, (err) => {
        reject(err);
      });
    });
  }

  private registerVSCodeDependencyService() {
    // `listFocus` 为 vscode 旧版 api，已经废弃，默认设置为 true
    this.contextKeyService.createKey('listFocus', true);

    const workbenchEditorService: WorkbenchEditorService = this.injector.get(WorkbenchEditorService);
    const commandService: CommandService = this.injector.get(CommandService);
    const commandRegistry = this.commandRegistry;

    commandRegistry.beforeExecuteCommand(async (command, args) => {
      await this.activationEventService.fireEvent('onCommand', command);
      return args;
    });

    commandRegistry.registerCommand(VSCodeCommands.SET_CONTEXT, {
      execute: (contextKey: any, contextValue: any) => {
        this.contextKeyService.createKey(String(contextKey), contextValue);
      },
    });

    commandRegistry.registerCommand(VSCodeCommands.WORKBENCH_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VSCodeCommands.REVERT_AND_CLOSE_ACTIVE_EDITOR);
    commandRegistry.registerCommand(VSCodeCommands.SPLIT_EDITOR_RIGHT);
    commandRegistry.registerCommand(VSCodeCommands.SPLIT_EDITOR_DOWN);
    commandRegistry.registerCommand(VSCodeCommands.NEW_UNTITLED_FILE);
    commandRegistry.registerCommand(VSCodeCommands.CLOSE_ALL_EDITORS);
    commandRegistry.registerCommand(VSCodeCommands.FILE_SAVE);
    commandRegistry.registerCommand(VSCodeCommands.SPLIT_EDITOR);
    commandRegistry.registerCommand(VSCodeCommands.SPLIT_EDITOR_ORTHOGONAL);
    commandRegistry.registerCommand(VSCodeCommands.NAVIGATE_LEFT);
    commandRegistry.registerCommand(VSCodeCommands.NAVIGATE_RIGHT);
    commandRegistry.registerCommand(VSCodeCommands.NAVIGATE_UP);
    commandRegistry.registerCommand(VSCodeCommands.NAVIGATE_DOWN);
    commandRegistry.registerCommand(VSCodeCommands.NAVIGATE_NEXT);
    commandRegistry.registerCommand(VSCodeCommands.PREVIOUS_EDITOR);
    commandRegistry.registerCommand(VSCodeCommands.PREVIOUS_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VSCodeCommands.NEXT_EDITOR);
    commandRegistry.registerCommand(VSCodeCommands.NEXT_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VSCodeCommands.EVEN_EDITOR_WIDTH);
    commandRegistry.registerCommand(VSCodeCommands.CLOSE_OTHER_GROUPS);
    commandRegistry.registerCommand(VSCodeCommands.LAST_EDITOR_IN_GROUP);
    commandRegistry.registerCommand(VSCodeCommands.OPEN_EDITOR_AT_INDEX);
    commandRegistry.registerCommand(VSCodeCommands.CLOSE_OTHER_EDITORS);
    commandRegistry.registerCommand(VSCodeCommands.REVERT_FILES);
    commandRegistry.registerCommand(VSCodeCommands.WORKBENCH_FOCUS_FILES_EXPLORER);
    commandRegistry.registerCommand(VSCodeCommands.WORKBENCH_FOCUS_ACTIVE_EDITOR_GROUP);

    commandRegistry.registerCommand(VSCodeCommands.OPEN, {
      execute: (uriComponents: UriComponents, columnOrOptions?: ViewColumn | TextDocumentShowOptions, label?: string) => {
        const uri = URI.from(uriComponents);
        const options: IResourceOpenOptions = {};
        if (columnOrOptions) {
          if (typeof columnOrOptions === 'number') {
            options.groupIndex = columnOrOptions;
          } else {
            options.groupIndex = columnOrOptions.viewColumn;
            options.preserveFocus = columnOrOptions.preserveFocus;
            options.range = columnOrOptions.selection;
            options.preview = columnOrOptions.preview;
          }
        }
        if (label) {
          options.label = label;
        }
        return workbenchEditorService.open(uri, options);
      },
    });

    commandRegistry.registerCommand(VSCodeCommands.DIFF, {
      execute: (left: UriComponents, right: UriComponents, title: string, options: any = {}) => {
        const openOptions: IResourceOpenOptions = {
          ...viewColumnToResourceOpenOptions(options.viewColumn),
          revealFirstDiff: true,
          ...options,
        };
        return commandService.executeCommand(EDITOR_COMMANDS.COMPARE.id, {
          original: URI.from(left),
          modified: URI.from(right),
          name: title,
        }, openOptions);
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

        return Object.assign({}, extension.toJSON(), { workerScriptPath });
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

  public async getProxy<T>(identifier: ProxyIdentifier<T>): Promise<T> {
    await this.ready.promise;
    return this.protocol.getProxy(identifier);
  }

  public async processNotExist(clientId: string) {
    const invalidReloadStrategy = this.getInvalidReloadStrategy();
    const okText = localize('kaitianExtension.invalidExthostReload.confirm.ok');
    const options = [okText];
    const ifRequiredReload = invalidReloadStrategy === 'ifRequired';
    if (ifRequiredReload) {
      options.unshift(localize('kaitianExtension.invalidExthostReload.confirm.cancel'));
    }

    const msg = await this.dialogService.info(
      localize('kaitianExtension.invalidExthostReload.confirm.content'),
      options,
      !!ifRequiredReload,
    );

    if (msg === okText) {
      this.clientApp.fireOnReload();
    }
  }

  public async processCrashRestart(clientId: string) {
    const invalidReloadStrategy = this.getInvalidReloadStrategy();
    const okText = localize('common.yes');
    const options = [okText];
    const ifRequiredReload = invalidReloadStrategy === 'ifRequired';
    if (ifRequiredReload) {
      options.unshift(localize('common.no'));
    }

    const msg = await this.messageService.info(
      localize('kaitianExtension.crashedExthostReload.confirm'),
      options,
      !!ifRequiredReload,
    );
    if (msg === okText) {
      await this.startProcess(false);
    }
  }

  private getInvalidReloadStrategy() {
    // 获取corePreferences配置判断是否弹出确认框
    return this.corePreferences['application.invalidExthostReload'];
  }
}
