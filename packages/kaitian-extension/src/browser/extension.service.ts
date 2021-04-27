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
  ExtensionHostType,
  EXTENSION_ENABLE,
  IExtensionHostService,
  ChangeExtensionOptions,
} from '../common';
import {
  MainThreadAPIIdentifier,
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
  IDisposable,
  CorePreferences,
  ExtensionActivateEvent,
  IToolbarPopoverRegistry,
} from '@ali/ide-core-browser';
import { isEmptyObject, replaceLocalizePlaceholder } from '@ali/ide-core-common';
import { Path, posix } from '@ali/ide-core-common/lib/path';
import { warning } from '@ali/ide-components/lib/utils/warning';
import { Extension } from './extension';
import { createApiFactory as createVSCodeAPIFactory } from './vscode/api/main.thread.api.impl';
import { createKaitianApiFactory } from './kaitian/main.thread.api.impl';

import { WorkbenchEditorService, IResourceOpenOptions } from '@ali/ide-editor';
import { IActivationEventService, ExtensionApiReadyEvent, ExtensionBeforeActivateEvent } from './types';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import {
  WSChannelHandler as IWSChanneHandler,
  RPCServiceCenter,
  initRPCService,
  createSocketConnection,
  RPCProtocol,
  ProxyIdentifier,
  IRPCProtocol,
} from '@ali/ide-connection';
import { createWebSocketConnection } from '@ali/ide-connection/lib/common/message';
import { VSCodeCommands } from './vscode/commands';
import { UriComponents } from '../common/vscode/ext-types';

import { IThemeService, IIconService } from '@ali/ide-theme';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ExtensionCandiDate as ExtensionCandidate, localize, OnEvent, WithEventBus } from '@ali/ide-core-common';
import { IKaitianBrowserContributions } from './kaitian-browser/types';
import { KaitianBrowserContributionRunner } from './kaitian-browser/contribution';
import { viewColumnToResourceOpenOptions, isLikelyVscodeRange, fromRange } from '../common/vscode/converter';
import { getShadowRoot } from './shadowRoot';
import { createProxiedWindow, createProxiedDocument } from './proxies';
import { getAMDDefine, getMockAmdLoader } from './loader';
import { KtViewLocation } from './kaitian/contributes/browser-views';
import { ExtensionNoExportsView } from './components';
import { createBrowserApi } from './kaitian-browser';
import { retargetEvents } from './retargetEvents';
import { ActivatedExtension } from '../common/activator';
import { WorkerExtensionService } from './extension.worker.service';

const LOAD_FAILED_CODE = 'load';

@Injectable()
export class ExtensionServiceImpl extends WithEventBus implements ExtensionService {

  async getActivatedExtensions(): Promise<{ [key in ExtensionHostType]?: ActivatedExtension[] }> {
    const activated = {};
    if (this.protocol) {
      const proxy: IExtensionHostService = this.protocol.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
      const extensions = await proxy.$getActivatedExtensions();
      activated['node'] = extensions;
    }
    if (this.workerService.protocol) {
      activated['worker'] = await this.workerService.getActivatedExtensions();
    }

    return activated;
  }

  private extensionScanDir: string[] = [];
  private extensionCandidate: string[] = [];
  private extraMetadata: IExtraMetaData = {};
  private protocol: RPCProtocol;

  @Autowired(IToolbarPopoverRegistry)
  protected readonly toolbarPopover: IToolbarPopoverRegistry;

  @Autowired(ExtensionNodeServiceServerPath)
  private extensionNodeService: IExtensionNodeClientService;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

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

  @Autowired(WorkerExtensionService)
  protected readonly workerService: WorkerExtensionService;

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

  private _onDidExtensionActivated: Emitter<IExtensionProps> = new Emitter<IExtensionProps>();
  public onDidExtensionActivated: Event<IExtensionProps> = this._onDidExtensionActivated.event;
  private shadowRootBodyMap: Map<string, HTMLBodyElement> = new Map();
  private portalShadowRootMap: Map<string, ShadowRoot> = new Map();

  @OnEvent(ExtensionActivateEvent)
  async onActivateExtension(e) {
    await this.activationEventService.fireEvent(e.payload.topic, e.payload.data);
  }

  public async activate(): Promise<void> {
    await this.initBaseData();
    // 前置 contribute 操作
    this.extensionMetaDataArr = await this.getAllExtensions();
    this.logger.verbose('kaitian extensionMetaDataArr', this.extensionMetaDataArr);
    await this.initExtension();
    await this.enableAvailableExtensions();
    await this.themeService.applyTheme(undefined, true);
    await this.iconService.applyTheme(undefined, true);
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

    await this.initCommonBrowserDependency();

    await Promise.all([
      this.startProcess(true),
      this.startWorkerHost(true),
    ]);

    try {
      await this.eventBus.fireAndAwait(new ExtensionBeforeActivateEvent());
      await this.activationEventService.fireEvent('*');
    } catch (err) {
      this.logger.error(`[Extension Activate Error], \n ${err.message || err}`);
    } finally {
      this.eagerExtensionsActivated.resolve();
      this.activationEventService.fireEvent('onStartupFinished');
      this.eventBus.fire(new ExtensionApiReadyEvent());
    }
  }

  public getExtensions() {
    return Array.from(this.extensionMap.values());
  }

  public getExtensionByExtId(extensionId: string) {
    return this.getExtensions().find((ext) => extensionId === ext.id);
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
      // 如果已经加载了一个 id 一样的插件，则不激活当前插件
      const sameExtension = this.extensionMetaDataArr?.find((metaData) => metaData.id === extensionMetadata.id);
      if (sameExtension) {
        this.logger.warn(`Extension ${extensionMetadata.id} already exists, skip acivate`);
        return;
      }
      const extension = this.injector.get(Extension, [
        extensionMetadata,
        this,
        await this.checkExtensionEnable(extensionMetadata),
        isBuiltin || (this.appConfig.extensionDir ? extensionMetadata.realPath.startsWith(this.appConfig.extensionDir) : false),
        false,
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

    if (this.appConfig.extWorkerHost) {
      await this.workerService.initExtension(Array.from(this.extensionMap.values()));
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
    const startUpActivationEvents = ['*', 'onStartupFinished'];

    const _activationEvents = activationEvents.filter((event) => event !== '*');
    const shouldFireEvents = Array.from(
      this.activationEventService.activatedEventSet.values(),
    ).filter(({ topic, data }) => _activationEvents.find((_event) => _event === `${topic}:${data}`));

    for (const event of startUpActivationEvents) {
      if (activationEvents.includes(event)) {
        this.logger.verbose(`Fire activation event ${event}`);
        this.activationEventService.fireEvent(event);
      }
    }

    for (const event of shouldFireEvents) {
      this.logger.verbose(`Fire activation event ${event.topic}:${event.data}`);
      this.activationEventService.fireEvent(event.topic, event.data);
    }
  }

  public async postDisableExtension(extensionPath: string) {
    const extension = this.extensionMap.get(extensionPath);
    if (extension) {
      extension.disable();
      extension.dispose();
      await this.updateExtensionHostData();
    }
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

    await Promise.all([
      this.startProcess(false),
      this.startWorkerHost(false),
    ]);
  }

  public async startProcess(init: boolean) {

    if (!init) {
      this.disposeExtensions();
      await this.initExtension();
      await this.enableAvailableExtensions();
      // await this.layoutContribute();
    }

    if (!this.appConfig.noExtHost) {
      await this.createExtProcess();
      this.vscodeAPIFactoryDisposer = await createVSCodeAPIFactory(this.protocol, this.injector, this);
      this.kaitianAPIFactoryDisposer = createKaitianApiFactory(this.protocol, this.injector);
      this.mainThreadCommands.set('node', this.protocol.get(MainThreadAPIIdentifier.MainThreadCommands));
      const proxy = this.protocol.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
      await proxy.$initExtensions();
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

  }

  public async startWorkerHost(init: boolean) {
    if (this.appConfig.extWorkerHost) {
      try {
        const protocol = await this.workerService.activate();
        this.mainThreadCommands.set('worker', protocol.get(MainThreadAPIIdentifier.MainThreadCommands));
      } catch (err) {
        this.logger.error(`Worker host activate fail, \n ${err.message}`);
      }
    }
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

  public async initCommonBrowserDependency() {
    getAMDDefine()('React', [], () => {
      return React;
    });
    getAMDDefine()('ReactDOM', [], () => {
      return ReactDOM;
    });
  }

  public async initKaitianBrowserAPIDependency(extension: IExtension) {
    getAMDDefine()('kaitian-browser', [], () => {
      return createBrowserApi(this.injector, extension, this.protocol);
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
  private getExtensionCandidateByPath(realPath: string): ExtensionCandidate | undefined {
    return this.appConfig.extensionCandidate && this.appConfig.extensionCandidate.find((extension) => extension.path === realPath);
  }

  private async initExtension() {
    for (const extensionMetaData of this.extensionMetaDataArr) {
      const extensionCandidate = this.getExtensionCandidateByPath(extensionMetaData.realPath);
      // 1. 通过路径判决是否是内置插件
      // 2. candidate 是否有  isBuiltin 标识符
      const isBuiltin = (this.appConfig.extensionDir ? extensionMetaData.realPath.startsWith(this.appConfig.extensionDir) : false) || (extensionCandidate ? extensionCandidate.isBuiltin : false);

      let isDevelopment = false;
      if (extensionCandidate) {
        isDevelopment = extensionCandidate.isDevelopment;
      }

      const extension = this.injector.get(Extension, [
        extensionMetaData,
        this,
        // 检测插件是否启用
        await this.checkExtensionEnable(extensionMetaData),
        isBuiltin,
        isDevelopment,
        this._onDidExtensionActivated,
      ]);

      this.extensionMap.set(extensionMetaData.path, extension);
    }

    this.workerService.initExtension(Array.from(this.extensionMap.values()));
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

    this.commandRegistry.beforeExecuteCommand(async (command, args) => {
      await this.activationEventService.fireEvent('onCommand', command);
      return args;
    });
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

    await this.extensionNodeService.createProcess(clientId, {
      enableDebugExtensionHost: this.appConfig.enableDebugExtensionHost,
    });

    await this.initExtProtocol();

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

  async executeExtensionCommand(command: string, args: any[]): Promise<void> {
    const targetHost = this.getExtensionCommand(command);
    if (!targetHost) {
      throw new Error('No Command with id "' + command + '" is declared by extensions');
    }
    // 需要等待插件进程启动完成再执行指令
    await this.ready.promise;
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

  private normalizeDeprecatedViewsConfig(moduleExports: { [key: string]: any }, extension: IExtension, proxiedHead?: HTMLHeadElement) {
    if (this.appConfig.useExperimentalShadowDom) {
      return Object.keys(moduleExports).filter((key) => moduleExports[key] && Array.isArray(moduleExports[key].component)).reduce((pre, cur) => {
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
      return Object.keys(views).filter((key) => views[key] && Array.isArray(views[key].component)).reduce((config, location) => {
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
      this.workerService.activeExtension(extension);
    }

    // TODO: 存储插件与 component 的关系，用于 dispose
    if (extendConfig.browser && extendConfig.browser.main) {
      this.logger.verbose(`register view by Deprecated config ${extension.id}`);
      const browserScriptURI = await this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.path).join(extendConfig.browser.main).toString()));
      try {
        const rawExtension = this.extensionMap.get(extension.path);
        if (this.appConfig.useExperimentalShadowDom) {
          this.registerPortalShadowRoot(extension.id);
          const { moduleExports, proxiedHead } = await this.loadBrowserModuleUseInterceptor<IKaitianBrowserContributions>(browserScriptURI.toString(), extension, true /** use export default ... */);
          this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension, proxiedHead), rawExtension!);
        } else {
          const { moduleExports } = await this.loadBrowserModule<IKaitianBrowserContributions>(browserScriptURI.toString(), extension, true /** use export default ... */);
          this.registerBrowserComponent(this.normalizeDeprecatedViewsConfig(moduleExports, extension), rawExtension!);
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
   * TODO: 支持底部面板多视图展示
   * should replace view component
   */
  static tabBarLocation = ['left', 'right'];

  /**
   * @see [KtViewLocation](#KtViewLocation) view location
   */
  private getRegisterViewKind(location: KtViewLocation) {
    return ExtensionServiceImpl.tabBarLocation.includes(location) ? 'replace' : 'add';
  }

  private async getExtensionModuleExports(url: string, extension: IExtension): Promise<{ moduleExports: any; proxiedHead?: HTMLHeadElement }> {
    if (this.appConfig.useExperimentalShadowDom) {
      return await this.loadBrowserModuleUseInterceptor<IKaitianBrowserContributions>(url, extension, false /** use named exports ... */);
    }
    const { moduleExports } = await this.loadBrowserModule(url, extension, false);
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

  private async doActivateExtension(extension: IExtension) {
    const { contributes } = extension;
    if (contributes && contributes.workerMain) {
      await this.workerService.activeExtension(extension);
    }

    if (contributes && contributes.browserMain) {
      // 这里路径遵循 posix 方式，fsPath 会自动根据平台转换
      const browserModuleUri = new URI(extension.extensionLocation.with({
        path: posix.join(extension.extensionLocation.path, contributes.browserMain),
      }));
      const { moduleExports, proxiedHead } = await this.getExtensionModuleExports(browserModuleUri.toString(), extension);
      if (contributes.browserViews) {
        const { browserViews } = contributes;
        if (this.appConfig.useExperimentalShadowDom) {
          this.registerPortalShadowRoot(extension.id);
        }
        const viewsConfig = Object.keys(browserViews).reduce((config, location) => {
          config[location] = {
            type: this.getRegisterViewKind(location as KtViewLocation),
            view: browserViews[location].view.map(({ id, titleComponentId, title, ...other }) => ({
              ...other,
              title: replaceLocalizePlaceholder(title, extension.id),
              id,
              component: this.getModuleExportsComponent(moduleExports, extension, id, proxiedHead),
              titleComponent: titleComponentId && this.getModuleExportsComponent(moduleExports, extension, titleComponentId, proxiedHead),
            })),
          };
          return config;
        }, {});
        this.registerBrowserComponent(viewsConfig, this.extensionMap.get(extension.path)!);
      }

      if (contributes.toolbar && contributes.toolbar?.actions) {
        for (const action of contributes.toolbar.actions) {
          if (action.type === 'button' && action.popoverComponent) {
            const popoverComponent = moduleExports[action.popoverComponent];
            if (!popoverComponent) {
              this.logger.error(`Can not find CustomPopover from extension ${extension.id}, id: ${action.popoverComponent}`);
              continue;
            }
            if (this.appConfig.useExperimentalShadowDom) {
              const shadowComponent = (props) => getShadowRoot(popoverComponent, extension, props, action.popoverComponent, proxiedHead);
              this.toolbarPopover.registerComponent(`${extension.id}:${action.popoverComponent}`, shadowComponent);
            } else {
              this.toolbarPopover.registerComponent(`${extension.id}:${action.popoverComponent}`, popoverComponent);
            }
          }
        }
      }

      return;
    }
  }

  public async activeExtension(extension: IExtension) {
    if (!this.appConfig.noExtHost) {
      const proxy = await this.getProxy<IExtensionHostService>(ExtHostAPIIdentifier.ExtHostExtensionService);
      await proxy.$activateExtension(extension.id);
    }
    const { extendConfig, packageJSON } = extension;
    // 对使用 kaitian.js 的老插件兼容
    // 因为可能存在即用了 kaitian.js 作为入口，又注册了 kaitianContributes 贡献点的插件
    if (extendConfig && !isEmptyObject(extendConfig)) {
      warning(false, '[Deprecated warning]: kaitian.js is deprecated, please use `package.json#kaitianContributes` instead');
      await this.activateExtensionByDeprecatedExtendConfig(extension);
      return;
    }

    if (packageJSON.kaitianContributes) {
      await this.doActivateExtension(extension);
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

  private createExtendProxy(protocol: IRPCProtocol, extensionId: string): typeof Proxy {
    const proxy = protocol.getProxy(new ProxyIdentifier(`${EXTENSION_EXTEND_SERVICE_PREFIX}:${extensionId}`));
    return this.dollarProxy(proxy);
  }

  private createExtensionExtendProtocol2(extension: IExtension, componentId: string) {
    const { id: extensionId } = extension;

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

            let nodeProxy;
            let workerProxy;

            if (this.protocol) {
              nodeProxy = this.createExtendProxy(this.protocol, extensionId);
            }

            if (this.workerService.protocol) {
              workerProxy = this.createExtendProxy(this.workerService.protocol, extensionId);
            }

            return {
              node: nodeProxy,
              worker: workerProxy,
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
            if (this.workerService.protocol) {
              this.workerService.protocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
            }
            if (this.protocol) {
              return this.protocol.set(componentProxyIdentifier as ProxyIdentifier<any>, service);
            }
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

  /**
   * 对于使用 kaitian.js 方式注册的 UI ，使用 default 导出
   * @example
   * ```ts
   * export default {
   *    left: {...},
   *    right: {...}
   * }
   * ```
   * 使用 browserViews Contributes 注册的 UI，不使用 default 导出，因为这种入口只导出组件，不包含 UI 相关配置
   * @example
   * ```ts
   * export const Component = {...};
   * export const ComponentB = {...};
   * ```
   */
  private async loadBrowserModuleUseInterceptor<T>(
    browserPath: string,
    extension: IExtension,
    defaultExports: boolean,
  ): Promise<{ moduleExports: T, proxiedHead: HTMLHeadElement }> {
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    const { _module, _exports, _require } = getMockAmdLoader<T>(this.injector, extension, this.protocol);
    const stylesCollection = [];
    const proxiedHead = document.createElement('head');
    const proxiedDocument = createProxiedDocument(proxiedHead);
    const proxiedWindow = createProxiedWindow(proxiedDocument, proxiedHead);

    const initFn = new Function('module', 'exports', 'require', 'styles', 'document', 'window', await pendingFetch.text());

    initFn(_module, _exports, _require, stylesCollection, proxiedDocument, proxiedWindow);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
      proxiedHead,
    };
  }

  private doFetch(url: string) {
    const options: RequestInit = {};
    if (this.appConfig.extensionFetchCredentials) {
      options.credentials = this.appConfig.extensionFetchCredentials;
    }

    const pendingFetch = fetch(url, options);
    return pendingFetch;
  }

  private async loadBrowserModule<T>(browserPath: string, extension: IExtension, defaultExports: boolean): Promise<any> {
    const pendingFetch = await this.doFetch(decodeURIComponent(browserPath));
    const { _module, _exports, _require } = getMockAmdLoader<T>(this.injector, extension, this.protocol);

    const initFn = new Function('module', 'exports', 'require', await pendingFetch.text());

    initFn(_module, _exports, _require);
    return {
      moduleExports: defaultExports ? _module.exports.default : _module.exports,
    };
  }

  private registerVSCodeDependencyService() {
    const workbenchEditorService: WorkbenchEditorService = this.injector.get(WorkbenchEditorService);
    const commandService: CommandService = this.injector.get(CommandService);
    const commandRegistry = this.commandRegistry;

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
    commandRegistry.registerCommand(VSCodeCommands.TOGGLE_WORKBENCH_VIEW_TERMINAL);

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
            // 这个range 可能是 vscode.range， 因为不会经过args转换
            if (columnOrOptions.selection && isLikelyVscodeRange(columnOrOptions.selection)) {
              columnOrOptions.selection = fromRange(columnOrOptions.selection);
            }
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
    return Array.from(this.extensionMap.values());
  }

  public async $activateExtension(extensionPath: string): Promise<void> {
    const extension = this.extensionMap.get(extensionPath);
    if (extension) {
      await extension.activate();
    }
  }

  public async $getStaticServicePath(): Promise<string> {
    return this.appConfig.staticServicePath || 'http://127.0.0.1:8000';
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
