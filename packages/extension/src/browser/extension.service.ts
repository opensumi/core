import debounce from 'lodash/debounce';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { RPCServiceChannelPath } from '@opensumi/ide-connection/lib/common/server-handler';
import {
  AppConfig,
  CommandRegistry,
  CorePreferences,
  Deferred,
  Disposable,
  ExtensionActivateEvent,
  IClientApp,
  ILogger,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import {
  CancelablePromise,
  CancellationToken,
  ExtensionActivatedEvent,
  ExtensionDidContributes,
  GeneralSettingsId,
  MayCancelablePromise,
  OnEvent,
  ProgressLocation,
  URI,
  WithEventBus,
  createCancelablePromise,
  getLanguageId,
  localize,
  sleep,
} from '@opensumi/ide-core-common';
import { DebugConfigurationsReadyEvent } from '@opensumi/ide-debug';
import { IExtensionStoragePathServer, IExtensionStorageService } from '@opensumi/ide-extension-storage';
import { FileSearchServicePath, IFileSearchService } from '@opensumi/ide-file-search/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  ERestartPolicy,
  ExtensionHostType,
  ExtensionNodeServiceServerPath,
  ExtensionService,
  IExtCommandManagement,
  IExtensionMetaData,
  IExtensionNodeClientService,
  LANGUAGE_BUNDLE_FIELD,
} from '../common';
import { ActivatedExtension } from '../common/activator';
import {
  AbstractNodeExtProcessService,
  AbstractViewExtProcessService,
  AbstractWorkerExtProcessService,
} from '../common/extension.service';
import { MainThreadAPIIdentifier } from '../common/vscode';

import { ActivationEventServiceImpl } from './activation.service';
import { Extension } from './extension';
import { SumiContributionsService, SumiContributionsServiceToken } from './sumi/contributes';
import {
  AbstractExtInstanceManagementService,
  ExtensionApiReadyEvent,
  ExtensionBeforeActivateEvent,
  ExtensionDidEnabledEvent,
  ExtensionDidUninstalledEvent,
  ExtensionsInitializedEvent,
  IActivationEventService,
} from './types';
import { VSCodeContributesService, VSCodeContributesServiceToken } from './vscode/contributes';

@Injectable()
export class ExtensionServiceImpl extends WithEventBus implements ExtensionService {
  static extraMetadata = {
    [LANGUAGE_BUNDLE_FIELD]: './package.nls.json',
  };

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(CommandRegistry)
  private readonly commandRegistry: CommandRegistry;

  @Autowired(IActivationEventService)
  private readonly activationEventService: ActivationEventServiceImpl;

  @Autowired(IWorkspaceService)
  private readonly workspaceService: IWorkspaceService;

  @Autowired(IExtensionStorageService)
  private readonly extensionStorageService: IExtensionStorageService;

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(IClientApp)
  private readonly clientApp: IClientApp;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(CorePreferences)
  private readonly corePreferences: CorePreferences;

  @Autowired(AbstractWorkerExtProcessService)
  private readonly workerExtensionService: AbstractWorkerExtProcessService;

  @Autowired(AbstractNodeExtProcessService)
  private readonly nodeExtensionService: AbstractNodeExtProcessService;

  @Autowired(AbstractViewExtProcessService)
  private readonly viewExtensionService: AbstractViewExtProcessService;

  @Autowired(IExtCommandManagement)
  private readonly extensionCommandManager: IExtCommandManagement;

  @Autowired(AbstractExtInstanceManagementService)
  private readonly extensionInstanceManageService: AbstractExtInstanceManagementService;

  @Autowired(FileSearchServicePath)
  private readonly fileSearchService: IFileSearchService;

  @Autowired(VSCodeContributesServiceToken)
  private readonly contributesService: VSCodeContributesService;

  @Autowired(SumiContributionsServiceToken)
  private readonly sumiContributesService: SumiContributionsService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IExtensionStoragePathServer)
  private readonly extensionStoragePathServer: IExtensionStoragePathServer;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IFileServiceClient)
  protected fileServiceClient: IFileServiceClient;

  constructor() {
    super();

    this.addDispose(
      this.fileServiceClient.onWillActivateFileSystemProvider(async () => {
        if (!this.extensionMetaDataArr) {
          await this.initExtensionMetaData();
        }
        return this.activationEventService.getTopicsData('onFileSystem');
      }),
    );
  }

  /**
   * 这里的 ready 是区分环境，将 node/worker 区分开使用
   */
  private ready = new Map<string, Deferred<void>>();

  // 存储 extension 的 meta 数据
  private extensionMetaDataArr: IExtensionMetaData[];

  // 插件进程是否正在重启中
  private isExtProcessRestarting = false;

  // 插件进程是否正在等待重启，页面不可见的时候被设置
  private isExtProcessWaitingForRestart: ERestartPolicy | undefined;
  private pCrashMessageModel: MayCancelablePromise<string | undefined> | undefined;

  // 针对 activationEvents 为 * 的插件
  public eagerExtensionsActivated: Deferred<void> = new Deferred();

  @Autowired(WSChannelHandler)
  private readonly channelHandler: WSChannelHandler;

  /**
   * @internal 提供获取所有运行中的插件的列表数据
   */
  async getActivatedExtensions(): Promise<{ [key in ExtensionHostType]?: ActivatedExtension[] }> {
    const activated = {};
    if (this.nodeExtensionService.protocol) {
      activated['node'] = await this.nodeExtensionService.getActivatedExtensions();
    }
    if (this.workerExtensionService.protocol) {
      activated['worker'] = await this.workerExtensionService.getActivatedExtensions();
    }

    return activated;
  }

  /**
   * 插件目录
   * 主要为插件的读取目录
   */
  private extensionScanDir = new Set<string>();

  /**
   * 补充的插件列表
   * 主要为插件的读取路径
   */
  private extensionCandidatePath = new Set<string>();

  @OnEvent(ExtensionActivateEvent)
  protected async onActivateExtension(e: ExtensionActivateEvent) {
    await this.activationEventService.fireEvent(e.payload.topic, e.payload.data);
  }

  /**
   * 插件激活后需更新插件进程数据
   */
  @OnEvent(ExtensionDidEnabledEvent)
  protected async onExtensionEnabled(e: ExtensionDidEnabledEvent) {
    const extension = e.payload;
    await this.updateExtHostData();
    await this.fireActivationEventsIfNeed(extension.packageJSON.activationEvents);
  }

  /**
   * 插件卸载后需更新插件进程数据
   */
  @OnEvent(ExtensionDidUninstalledEvent)
  protected async onExtensionUninstalled() {
    await this.updateExtHostData();
  }

  public async activate(): Promise<void> {
    await this.initExtensionMetaData();
    await this.initExtensionInstanceData();
    await this.runEagerExtensionsContributes();
    // update nls config by extensions
    await this.setupExtensionNLSConfig();

    this.doActivate();

    // 监听页面展示状态，当页面状态变为可见且插件进程待重启的时候执行
    const onPageVisibilitychange = () => {
      this.logger.log(
        '[ext-restart]: page visibility change, current:',
        document.visibilityState,
        'is waiting:',
        this.isExtProcessWaitingForRestart,
        'is restarting:',
        this.isExtProcessRestarting,
      );

      if (
        document.visibilityState === 'visible' &&
        this.isExtProcessWaitingForRestart &&
        !this.isExtProcessRestarting
      ) {
        this.extProcessRestartHandler(this.isExtProcessWaitingForRestart);
      }
    };

    document.addEventListener('visibilitychange', onPageVisibilitychange, false);

    this.addDispose(
      Disposable.create(() => {
        document.removeEventListener('visibilitychange', onPageVisibilitychange);
      }),
    );
  }

  private async setupExtensionNLSConfig() {
    const storagePath = (await this.extensionStoragePathServer.getLastStoragePath()) || '';
    const currentLanguage: string = this.preferenceService.get(GeneralSettingsId.Language) || getLanguageId();
    await this.extensionNodeClient.setupNLSConfig(currentLanguage, storagePath);
  }

  /**
   * 初始化插件列表数据
   * 包括插件目录和插件 Candidate
   * 以及 ExtensionMetaData
   */
  private async initExtensionMetaData() {
    const { extensionDir, extensionCandidate } = this.appConfig;
    if (extensionDir) {
      this.extensionScanDir.add(extensionDir);
    }
    if (extensionCandidate) {
      extensionCandidate.forEach((extension) => {
        this.extensionCandidatePath.add(extension.path);
      });
    }

    await this.getExtensionsMetaData(Array.from(this.extensionScanDir), Array.from(this.extensionCandidatePath));
  }

  /**
   * 初始化插件实例数据
   */
  private async initExtensionInstanceData() {
    for (const extensionMetaData of this.extensionMetaDataArr) {
      const isBuiltin = this.extensionInstanceManageService.checkIsBuiltin(extensionMetaData);
      const isDevelopment = this.extensionInstanceManageService.checkIsDevelopment(extensionMetaData);
      const extension = await this.extensionInstanceManageService.createExtensionInstance(
        extensionMetaData,
        isBuiltin,
        isDevelopment,
      );
      if (extension) {
        this.extensionInstanceManageService.addExtensionInstance(extension);
      }

      if (extension?.contributes && extension.enabled) {
        this.contributesService.register(extension.id, extension.contributes);
        this.sumiContributesService.register(extension.id, extension.packageJSON.sumiContributes || {});
      }
    }

    this.eventBus.fire(new ExtensionsInitializedEvent(this.extensionInstanceManageService.getExtensionInstances()));
    this.eventBus.fire(new DebugConfigurationsReadyEvent(undefined));

    const extensionInstanceList = this.extensionInstanceManageService.getExtensionInstances();
    this.nodeExtensionService.updateExtensionData(extensionInstanceList);
    this.workerExtensionService.updateExtensionData(extensionInstanceList);
    this.viewExtensionService.initExtension(extensionInstanceList);
  }

  private async doActivate() {
    await this.workspaceService.whenReady;
    await this.extensionStorageService.whenReady;

    await this.viewExtensionService.activate();

    // 启动插件进程
    await this.startExtProcess(true);

    try {
      await this.eventBus.fireAndAwait(new ExtensionBeforeActivateEvent());
      await this.activationEventService.fireEvent('*');
    } catch (err) {
      this.logger.error(`[Extension Activate Error], \n ${err.message || err}`);
    } finally {
      // 表示 * 的插件全部激活完了
      this.eagerExtensionsActivated.resolve();
      this.activationEventService.fireEvent('onStartupFinished');
      // 表示 * 的插件可以调了
      this.eventBus.fire(new ExtensionApiReadyEvent());
    }
  }

  /**
   * 重启插件进程
   */
  public async restartExtProcess(restartPolicy: ERestartPolicy = ERestartPolicy.Always) {
    /**
     * 只有在页面可见的情况下才执行插件进程重启操作
     * 如果当前页面不可见，那么 chrome 会对 socket 进行限流，导致进程重启的 rpc 调用得不到返回从而卡住
     */
    if (document.visibilityState === 'visible') {
      this.extProcessRestartHandler(restartPolicy);
    } else {
      this.logger.log('[ext-restart]: page is not visible, waiting for restart, policy:', restartPolicy);
      this.isExtProcessWaitingForRestart = restartPolicy;
    }
  }

  private extProcessRestartPromise: CancelablePromise<void> | undefined;

  private disposeAllOverlayWindow() {
    if (this.pCrashMessageModel) {
      // crash message model is still open, close it
      this.pCrashMessageModel.cancel?.();
      this.pCrashMessageModel = undefined;
    }
  }

  restartProgress = async (restartPolicy: ERestartPolicy = ERestartPolicy.Always) => {
    const doRestart = async (token: CancellationToken) => {
      this.disposeAllOverlayWindow();

      token.onCancellationRequested(() => {
        this.logger.log('[ext-restart]: ext process restart canceled');
        this.isExtProcessRestarting = false;
        this.isExtProcessWaitingForRestart = undefined;
      });

      try {
        await this.startExtProcess(false);
      } catch (err) {
        this.logger.error(`[ext-restart]: ext-host restart failure, error: ${err}`);
      }

      this.isExtProcessRestarting = false;
      this.isExtProcessWaitingForRestart = undefined;

      this.disposeAllOverlayWindow();
    };

    await this.channelHandler.awaitChannelReady(RPCServiceChannelPath);

    const policy = this.isExtProcessWaitingForRestart || restartPolicy;
    this.logger.log('[ext-restart]: restart ext process, restart policy:', policy);

    switch (policy) {
      // @ts-expect-error Need fall-through
      case ERestartPolicy.WhenExit:
        // if we can get the pid, then the process is still running, no need to restart.
        // if pid is null, it means the process is exited, then we need to start it.
        if (await this.getExtProcessPID()) {
          this.logger.log('[ext-restart]: ext process is still running, skip');
          break;
        }
      case ERestartPolicy.Always:
        await this.progressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: localize('extension.exthostRestarting.content'),
            buttons: [
              {
                id: 'extension.reload',
                label: localize('preference.general.language.change.refresh.now'),
                primary: true,
                run: async () => {
                  this.clientApp.fireOnReload();
                },
                dispose: () => {},
              },
            ],
          },
          async () => {
            if (this.extProcessRestartPromise) {
              this.extProcessRestartPromise.cancel();
            }
            this.extProcessRestartPromise = createCancelablePromise(doRestart);
            await this.extProcessRestartPromise;
          },
        );

        break;
    }

    this.isExtProcessRestarting = false;
  };

  restartDebounced = debounce(async () => {
    await this.restartProgress();
  }, 500);

  private async extProcessRestartHandler(restartPolicy: ERestartPolicy = ERestartPolicy.Always) {
    if (this.isExtProcessRestarting && restartPolicy !== ERestartPolicy.Always) {
      this.logger.log('[ext-restart]: ext process is restarting, skip');
      return;
    }

    this.isExtProcessRestarting = true;

    if (this.isExtProcessWaitingForRestart) {
      /**
       * 只有当页面不可见的时候被通知执行重启操作，isExtProcessWaitingForRestart 才会为 true
       * 目前观察到页面从不可见恢复至可见状态后，可能出现 socket 堆积的现象，因此延迟 1000ms 后再进行重启操作
       * 这里延时并不能保证一定能够正确重启，只是降低失败的可能性。在解决了 socket 堆积的情况后，可以直接去掉
       */
      this.restartDebounced();
    } else {
      this.restartProgress(restartPolicy);
    }
  }

  private async getExtProcessPID(): Promise<number | null> {
    return await Promise.race([
      this.extensionNodeClient.pid().catch(async (err) => {
        this.logger.error(`[ext-restart]: get ext process pid error, ${err}`);
        await sleep(200);
        return null;
      }),
      sleep(1000).then(() => null),
    ]);
  }

  private async startExtProcess(init: boolean) {
    /**
     * 重启插件进程步骤：
     * 1、重置所有插件实例的状态至未激活
     * 2、dispose 掉所有被激活且在 contributes 里申明过 browserView 的 sumi 插件
     * 3、将负责前后端通信的 main.thread 全部 dispose 掉
     * 4、杀掉后端插件进程
     * 5、走正常激活插件流程，重新激活对应插件进程
     * 6、将之前已经激活的插件重新激活一遍
     */
    if (!init) {
      this.resetExtensionInstances();
      this.disposeSumiViewExtension();
      await this.disposeExtProcess();
    }

    // set ready for node/worker
    await Promise.all([this.startNodeExtHost(init), this.startWorkerExtHost(init)]);

    if (!init) {
      // 重启场景下需要将申明过 browserView 的 sumi 插件的 contributes 重新跑一遍
      await this.rerunSumiViewExtensionContributes();
      // 重启场景下把 ActivationEvent 再发一次
      if (this.activationEventService.activatedEventSet.size) {
        const activatedEventArr = Array.from(this.activationEventService.activatedEventSet);

        this.activationEventService.activatedEventSet.clear();

        await Promise.allSettled(
          activatedEventArr.map((event) => {
            const { topic, data } = JSON.parse(event);
            this.logger.verbose('fireEvent', 'event.topic', topic, 'event.data', data);
            return this.activationEventService.fireEvent(topic, data);
          }),
        );
      }
    }
  }

  private async startNodeExtHost(init: boolean) {
    if (this.appConfig.noExtHost) {
      return;
    }

    // 激活 node 插件进程
    const protocol = await this.nodeExtensionService.activate();
    this.extensionCommandManager.registerProxyCommandExecutor(
      'node',
      protocol.get(MainThreadAPIIdentifier.MainThreadCommands),
    );

    if (init) {
      this.ready.set('node', this.nodeExtensionService.ready);
    }
  }

  private async startWorkerExtHost(init: boolean) {
    // 激活 worker 插件进程
    if (!this.appConfig.extWorkerHost) {
      return;
    }

    try {
      const protocol = await this.workerExtensionService.activate(this.appConfig.ignoreWorkerHostCors);
      this.extensionCommandManager.registerProxyCommandExecutor(
        'worker',
        protocol.get(MainThreadAPIIdentifier.MainThreadCommands),
      );
      if (init) {
        this.ready.set('worker', this.workerExtensionService.ready);
      }
    } catch (err) {
      this.logger.error(`Worker host activate fail, \n ${err.message}`);
    }
  }

  /**
   * 更新插件进程中插件的数据
   */
  private async updateExtHostData() {
    const extensions = this.extensionInstanceManageService.getExtensionInstances();
    if (!this.appConfig.noExtHost) {
      await this.nodeExtensionService.updateExtensionData(extensions);
    }

    if (this.appConfig.extWorkerHost) {
      await this.workerExtensionService.updateExtensionData(extensions);
    }
  }

  /**
   * 发送 ActivationEvents
   */
  private async fireActivationEventsIfNeed(activationEvents: string[]) {
    if (!Array.isArray(activationEvents) || !activationEvents.length) {
      return;
    }

    const startUpActivationEvents = ['*', 'onStartupFinished'];

    const _activationEvents = activationEvents.filter((event) => event !== '*');
    const shouldFireEvents = Array.from(this.activationEventService.activatedEventSet)
      .map((event) => JSON.parse(event))
      .filter(({ topic, data }) => _activationEvents.find((_event) => _event === `${topic}:${data}`));

    for (const event of startUpActivationEvents) {
      if (activationEvents.includes(event)) {
        this.logger.verbose(`Fire activation event ${event}`);
        this.activationEventService.fireEvent(event);
      }
    }

    for (const event of shouldFireEvents) {
      const { topic, data } = event;
      this.logger.verbose(`Fire activation event ${topic}:${data}`);
      this.activationEventService.fireEvent(topic, data);
    }
    await this.activateByWorkspaceContains(activationEvents);
  }

  private async activateByWorkspaceContains(activationEvents: string[]) {
    if (!Array.isArray(activationEvents) || !activationEvents.length) {
      return;
    }
    const paths: string[] = [];
    const includePatterns: string[] = [];
    for (const activationEvent of activationEvents) {
      if (/^workspaceContains:/.test(activationEvent)) {
        const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
        if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
          includePatterns.push(fileNameOrGlob);
        } else {
          paths.push(fileNameOrGlob);
        }
      }
    }

    const promises: Promise<boolean>[] = [];
    if (paths.length) {
      promises.push(this.workspaceService.containsSome(paths));
    }

    if (includePatterns.length) {
      promises.push(
        (async () => {
          try {
            const result = await this.fileSearchService.find('', {
              rootUris: this.workspaceService.tryGetRoots().map((stat) => new URI(stat.uri).codeUri.fsPath),
              includePatterns,
              limit: 1,
            });
            return result.length > 0;
          } catch (e) {
            this.logger.error(e);
            return false;
          }
        })(),
      );
    }

    if (promises.length && (await Promise.all(promises).then((exists) => exists.some((v) => v)))) {
      this.activationEventService.fireEvent('workspaceContains', [...paths, ...includePatterns][0]);
    }
  }

  /**
   * 将插件的目录位置和文件位置，通过后端读取并缓存
   * 返回所有插件的 meta data
   */
  private async getExtensionsMetaData(
    extensionScanDir: string[],
    extensionCandidatePath: string[],
  ): Promise<IExtensionMetaData[]> {
    if (!this.extensionMetaDataArr) {
      const extensions = await this.extensionNodeClient.getAllExtensions(
        extensionScanDir,
        extensionCandidatePath,
        getLanguageId(),
        ExtensionServiceImpl.extraMetadata,
      );
      this.extensionMetaDataArr = extensions;
    }

    this.logger.log('extensions count:', this.extensionMetaDataArr.length);
    return this.extensionMetaDataArr;
  }

  private async runEagerExtensionsContributes() {
    await Promise.all([this.contributesService.initialize(), this.sumiContributesService.initialize()]);

    this.commandRegistry.beforeExecuteCommand(async (command, args) => {
      await this.activationEventService.fireEvent('onCommand', command);
      return args;
    });
    this.eventBus.fire(new ExtensionDidContributes());
  }

  /**
   * 激活插件的 Contributes
   */
  public async runExtensionContributes() {
    const extensions = Array.from(this.extensionInstanceManageService.getExtensionInstances() as Extension[]);

    // try fire workspaceContains activateEvent ，这里不要 await
    Promise.all(
      extensions.map((extension) => this.activateByWorkspaceContains(extension.packageJSON.activationEvents)),
    ).catch((error) => this.logger.error(error));
  }

  /**
   * 判断是否是 web 插件
   * 这里会多增加一个判断：是否启动了 node-ext-host
   * https://code.visualstudio.com/api/extension-guides/web-extensions#web-extension-enablement
   */
  private whetherWebExtension({ packageJSON }: Extension): boolean {
    const { browser, main } = packageJSON || {};
    const noExtHost = Boolean(this.appConfig.noExtHost);

    // 如果只包含 browser 入口
    if (browser && !main) {
      return true;
    }

    // 如果同时包含两个入口，那么判断是否启动了node插件进程
    if (browser && main) {
      return noExtHost;
    }

    // 只包含 main 入
    if (!browser && main) {
      return false;
    }

    /**
     * 都不包含的情况下：
     * 如果contributes中含有'debuggers', 'terminal', 'typescriptServerPlugins'三个之一，那么不作为web插件启动
     * 如果不包含，那么判断是否启动了node插件进程
     */
    if (typeof packageJSON.contributes !== 'undefined') {
      for (const id of ['debuggers', 'terminal', 'typescriptServerPlugins']) {
        if (packageJSON.contributes.hasOwnProperty(id)) {
          return false;
        }
      }
    }

    return noExtHost;
  }

  /**
   * 给 Extension 使用 | 激活插件
   */
  public async activeExtension(extension: Extension) {
    const isWebExtension = this.whetherWebExtension(extension);

    if (isWebExtension && !this.appConfig.extWorkerHost) {
      this.logger.error('[extension.service]: has no ext worker host');
    }

    // 优先激活 Node 和 Worker 进程中的插件
    // 这个时序下，不允许存在 Node/Worker 互相依赖的情况
    // 插件 Browser 中可以依赖 Node/Worker
    await Promise.all([
      this.nodeExtensionService.activeExtension(extension, isWebExtension),
      this.workerExtensionService.activeExtension(extension, isWebExtension),
    ]);

    await this.viewExtensionService.activeExtension(extension, this.nodeExtensionService.protocol);
    this.eventBus.fire(new ExtensionActivatedEvent({ topic: 'onExtensionActivated', data: { id: extension.id } }));
  }

  private resetExtensionInstances() {
    this.extensionInstanceManageService.resetExtensionInstances();

    this.nodeExtensionService.disposeApiFactory();
    this.workerExtensionService.disposeApiFactory();
  }

  /**
   * 每次激活 sumi 插件的时候，都会尝试去激活 sumiContributes 中的 browserView，会导致 browserView 重复注册
   * 因此重启场景下需要先将这部分被激活的插件 dispose 掉
   */
  private disposeSumiViewExtension() {
    const paths = Array.from(this.viewExtensionService.activatedViewExtensionMap.keys());

    this.extensionInstanceManageService.disposeExtensionInstancesByPath(paths);
  }

  private async rerunSumiViewExtensionContributes() {
    const { activatedViewExtensionMap } = this.viewExtensionService;
    const extensionPaths = Array.from(activatedViewExtensionMap.keys());

    await Promise.all(
      extensionPaths.map((path) => {
        const extension = this.extensionInstanceManageService.getExtensionInstanceByPath(path);
        if (extension) {
          extension.initialize();
          this.contributesService.register(extension.id, extension.contributes);
          this.sumiContributesService.register(extension.id, extension.packageJSON.sumiContributes || {});
        }
      }),
    );
    activatedViewExtensionMap.clear();

    await Promise.all([this.contributesService.initialize(), this.sumiContributesService.initialize()]);
  }

  async disposeExtProcess() {
    await this.nodeExtensionService.disposeProcess();
    await this.workerExtensionService.disposeProcess();
  }

  public async disposeExtensions() {
    // 重置掉插件实例
    this.extensionInstanceManageService.disposeExtensionInstances();
  }

  // 给 contributes#command 注册 command executor 使用
  public async executeExtensionCommand(command: string, args: any[]): Promise<void> {
    const targetEnv = this.extensionCommandManager.getExtensionCommandEnv(command);
    if (!targetEnv) {
      throw new Error('No Command with id "' + command + '" is declared by extensions');
    }

    // 需要等待对应插件进程启动完成再执行指令
    await this.ready.get(targetEnv)?.promise;
    // 这里相比之前有个变化，之前是先找 command 存不存在，然后等 ready 再执行
    // 现在是先等 ready 再去找 command 再去执行
    return this.extensionCommandManager.executeExtensionCommand(targetEnv, command, args);
  }

  // 暴露给后端调用前端时使用，用来处理插件进程不存在和 crash/restart 时的弹窗
  private get invalidReloadStrategy() {
    // 获取corePreferences配置判断是否弹出确认框
    return this.corePreferences['application.invalidExthostReload'];
  }

  // RPC call from node
  public async $restartExtProcess() {
    this.logger.log('[ext-restart]: receive the command from the node side to restart the process');
    await this.restartExtProcess(ERestartPolicy.Always);
  }

  public async $processNotExist() {
    // if browser receive the message, means the connection is keep alive
    // so we still need to restart the ext process
    this.logger.log('[ext-restart]: receive the command from the node side that the process does not exist');
    this.$restartExtProcess();
    return 'ok';
  }

  public async showReloadWindow() {
    const okText = localize('extension.invalidExthostReload.confirm.ok');
    const options = [okText];
    const ifRequiredReload = this.invalidReloadStrategy === 'ifRequired';
    if (ifRequiredReload) {
      options.unshift(localize('extension.invalidExthostReload.confirm.cancel'));
    }

    const msg = await this.dialogService.info(
      localize('extension.invalidExthostReload.confirm.content'),
      options,
      !!ifRequiredReload,
    );

    if (msg === okText) {
      this.clientApp.fireOnReload();
    }
  }

  public async $processCrashRestart() {
    if (this.pCrashMessageModel) {
      this.pCrashMessageModel.cancel?.();
    }

    const okText = localize('common.yes');
    const options = [okText];
    const ifRequiredReload = this.invalidReloadStrategy === 'ifRequired';
    if (ifRequiredReload) {
      options.unshift(localize('common.no'));
    }

    this.pCrashMessageModel = this.messageService.info(
      localize('extension.crashedExthostReload.confirm'),
      options,
      !!ifRequiredReload,
    );

    const msg = await this.pCrashMessageModel;
    this.pCrashMessageModel = undefined;

    if (msg === okText) {
      await this.restartExtProcess(ERestartPolicy.Always);
    }
  }
}
