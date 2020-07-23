import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IExtensionManagerService, RawExtension, ExtensionDetail, ExtensionManagerServerPath, IExtensionManagerServer, DEFAULT_ICON_URL, SearchState, EnableScope, TabActiveKey, SearchExtension, RequestHeaders, BaseExtension, ExtensionMomentState, OpenExtensionOptions, ExtensionChangeEvent, ExtensionChangeType } from '../common';
import { ExtensionService, IExtensionProps, EXTENSION_ENABLE, ExtensionDependencies } from '@ali/ide-kaitian-extension/lib/common';
import { action, observable, computed, runInAction } from 'mobx';
import { Path } from '@ali/ide-core-common/lib/path';
import * as compareVersions from 'compare-versions';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { URI, ILogger, replaceLocalizePlaceholder, debounce, StorageProvider, STORAGE_NAMESPACE, localize, IClientApp } from '@ali/ide-core-browser';
import { IDisposable, dispose, getLanguageId, IReporterService, REPORT_NAME, formatLocalize, IEventBus } from '@ali/ide-core-common';
import { IMenu, AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { IContextKeyService } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMessageService } from '@ali/ide-overlay';
import { EditorPreferences } from '@ali/ide-editor/lib/browser';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

// IExtensionProps 属性为 readonly，改为 writeable
type IExtension = Writeable<IExtensionProps> & {
  enableScope: EnableScope,
  reloadRequire?: boolean;
  installed: boolean;
};

@Injectable()
export class ExtensionManagerService implements IExtensionManagerService {

  @Autowired()
  protected extensionService: ExtensionService;

  @Autowired()
  protected staticResourceService: StaticResourceService;

  @Autowired(ExtensionManagerServerPath)
  private extensionManagerServer: IExtensionManagerServer;

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(EditorPreferences)
  editorPreferences: EditorPreferences;

  @Autowired(IMessageService)
  messageService: IMessageService;

  private readonly disposables: IDisposable[] = [];

  @observable
  extensions: IExtension[] = [];

  @observable
  loading: SearchState =  SearchState.LOADED;

  @observable
  searchMarketplaceState: SearchState = SearchState.LOADED;

  @observable
  searchInstalledState: SearchState = SearchState.LOADED;

  @observable
  searchMarketplaceResults: RawExtension[] = [];

  @observable
  searchInstalledResults: RawExtension[] = [];

  @observable
  hotExtensions: RawExtension[] = [];

  @observable
  marketplaceQuery: string = '';

  @observable
  installedQuery: string = '';

  @observable
  tabActiveKey = TabActiveKey.MARKETPLACE;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  @Autowired(IClientApp)
  clientApp: IClientApp;

  @observable
  isInit: boolean = false;

  @observable contextMenu: IMenu;

  @observable
  extensionMomentState: Map<string, ExtensionMomentState> = new Map<string, ExtensionMomentState>();

  // 是否显示内置插件
  private isShowBuiltinExtensions: boolean = false;

  private hotPageIndex = 1;

  constructor() {
    // 创建 contextMenu
    this.contextMenu = this.menuService.createMenu(MenuId.ExtensionContext, this.contextKeyService);
    this.disposables.push(this.contextMenu);
    this.disposables.push(this.extensionService.onDidExtensionActivated(async (e) => {
      if (!e.isBuiltin) {
        await this.checkExtensionUpdates(e);
      }
    }));
  }

  dispose(): void {
    dispose(this.disposables);
  }

  @action
  searchFromMarketplace(query: string) {
    this.searchMarketplaceState = SearchState.LOADING;
    this.searchMarketplaceResults = [];
    this.searchExtensionFromMarketplace(query);
  }

  @action
  searchFromInstalled(query: string) {
    this.searchInstalledState = SearchState.LOADING;
    this.searchInstalledResults = [];
    this.searchExtensionFromInstalled(query);
  }

  @action
  @debounce(300)
  private async searchExtensionFromMarketplace(query: string) {
    try {
      const installedExtensions = this.showExtensions.filter((extension) => {
        return extension.name.includes(query) || (extension.displayName && extension.displayName.includes(query));
      });
      this.searchMarketplaceResults = installedExtensions;
      // 排除掉已安装的插件
      const res = await this.extensionManagerServer.search(query, this.installedIds);
      if (res.count > 0 || installedExtensions.length > 0) {
        const data = res.data.map(this.transformMarketplaceExtension);
        runInAction(() => {
          this.searchMarketplaceResults = [...installedExtensions, ...data];
          this.searchMarketplaceState = SearchState.LOADED;
        });
      } else {
        runInAction(() => {
          this.searchMarketplaceResults = [];
          this.searchMarketplaceState = SearchState.NO_CONTENT;
        });
      }

    } catch (err) {
      this.logger.error(err);
      runInAction(() => {
        this.searchMarketplaceResults = [];
        this.searchMarketplaceState = SearchState.NO_CONTENT;
      });
    }
  }

  @action
  @debounce(300)
  private searchExtensionFromInstalled(query: string) {
    const data = this.showExtensions.filter((extension) => {
      return extension.name.includes(query) || (extension.displayName && extension.displayName.includes(query));
    });
    if (data.length > 0) {
      this.searchInstalledResults = data;
      this.searchInstalledState = SearchState.LOADED;
    } else {
      this.searchInstalledState = SearchState.NO_CONTENT;
    }
  }

  private async checkExtensionUpdates(e: IExtensionProps) {
    try {
      const current = await this.getDetailById(e.extensionId);
      const latest = await this.getDetailFromMarketplace(e.extensionId);
      if (!latest || !current) {
        this.logger.warn(`Can not find extension ${e.extensionId} from marketplace.`);
        return;
      }
      const delayUpdate = localize('marketplace.extension.update.delay');
      const nowUpdate = localize('marketplace.extension.update.now');

      const delayReload = localize('marketplace.extension.reload.delay');
      const nowReload = localize('marketplace.extension.reload.now');
      if (compareVersions(current.version, latest.version) === -1) {
        this.messageService.info(
          formatLocalize('marketplace.extension.findUpdate', latest.displayName || latest.name, latest.version), [delayUpdate, nowUpdate],
        )
        .then((message) => {
          if (message === nowUpdate) {
            this.updateExtension(current, latest.version)
              .then(() => this.messageService.info(formatLocalize('marketplace.extension.needreload', latest.displayName || latest.name), [delayReload, nowReload]))
              .then((value) => {
                if (value === nowReload) {
                  this.clientApp.fireOnReload();
                }
              });
          }
        });
      }
    } catch (err) {
      this.logger.warn(err.message);
    }
  }

  /**
   * 通过 extId 获取插件
   * @param extensionId
   */

  private getExtension(extensionId): IExtension | void {
    return this.extensions.find((extension) => extension.extensionId === extensionId);
  }

  /**
   * 获取这个插件的所有依赖
   * @param extensionId
   * @param version
   * dependencies: (string | { [key: string]: string })[]
   */
  async getExtDeps(extensionId, version?): Promise<ExtensionDependencies> {
    try {
      const res = await this.extensionManagerServer.getExtensionDeps(extensionId, version);
      return res?.data?.dependencies || [];
    } catch (e) {
      this.logger.error(e);
      return [];
    }
  }

  /**
   * 获取 publisher.name 格式的 extensionId
   * @param extension
   */

  public getExtensionId(extension: BaseExtension): string {
    const isPublisherDotName = (extensionId) => /^\w+\.\w+$/.test(extensionId);

    return isPublisherDotName(extension?.extensionId)
      ? extension.extensionId
      : `${extension.publisher}.${extension.name}`;
  }

  /**
   * 安装插件，同时安装依赖插件
   * @param extension 插件基础信息
   * @param version 指定版本
   */
  async installExtension(extension: BaseExtension, version?: string): Promise<string | void> {
    const extensionId = extension.extensionId || `${extension.publisher}.${extension.name}`;

    // 先安装依赖插件，最后装自己，loading 效果先放出来，避免被误解为卡死
    this.extensionMomentState.set(extensionId, {
      isInstalling: true,
    });

    try {
      const deps = await this.getExtDeps(extension.extensionId, version || extension.version);
      for (const dep of deps) {
        let depVersion = '*';
        let depId = dep;
        if (!(typeof dep === 'string')) {
          depId = Object.keys(dep)[0];
          depVersion = dep[depId];
        }

        // 如果这个扩展已被安装，则跳过
        if (this.installedIds.includes(depId as string)) {
          continue;
        }
        const subExtensionRes = await this.extensionManagerServer.getExtensionFromMarketPlace(depId as string, depVersion);

        const subExt = subExtensionRes?.data as BaseExtension;
        // 安装依赖
        await this.installExtensionSingle({
            name: subExt?.name,
            version: subExt?.version,
            publisher: subExt?.publisher,
            extensionId: this.getExtensionId(subExt),

            // 依赖插件的 builtin 与父亲保持一致
            isBuiltin: extension.isBuiltin,
            path: '',
          }, subExt?.version);
      }
      // 最后安装自己
      const targetExtensionPath = await this.installExtensionSingle(extension, version);
      return targetExtensionPath;
    } catch (e) {
      this.extensionMomentState.set(extensionId, {
        isInstalling: false,
      });
      this.messageService.error(e.message);
    }
  }

  /**
   * 安装插件
   * @param extension 插件基础信息
   * @param version 指定版本
   */
  async installExtensionSingle(extension: BaseExtension, version?: string): Promise<string> {
    const extensionId = extension.extensionId || `${extension.publisher}.${extension.name}`;
    const isBuiltin = !!extension.isBuiltin;

    this.extensionMomentState.set(extensionId, {
      isInstalling: true,
    });
    // 1. 调用后台下载插件
    let path = '';
    try {
      path = await this.extensionManagerServer.installExtension(extension, version || extension.version);
    } catch (error) {
      this.logger.error(error);
      this.extensionMomentState.set(extensionId, {
        isInstalling: false,
      });
      this.messageService.error(error.message);
      this.reporterService.point(REPORT_NAME.INSTALL_EXTENSION_ERROR, extensionId);
      return '';
    }
    const reloadRequire = await this.computeReloadState(path);

    if (!reloadRequire) {
      // 2. 更新插件进程信息
      await this.extensionService.postChangedExtension({
        upgrade: false,
        extensionPath: path,
        isBuiltin,
      });
      const extension = this.getExtension(extensionId);
      // 如果有这个插件，直接置为这个插件已安装
      if (extension) {
        extension.installed = true;
        extension.enabled = true;
        extension.reloadRequire = reloadRequire;
        extension.isBuiltin = isBuiltin;
      } else {
        const extensionProp = await this.extensionService.getExtensionProps(path);
        if (extensionProp) {
          const extension = await this.transformFromExtensionProp(extensionProp);
          // 添加到 extensions，下次获取 rawExtension
          runInAction(() => {
            this.extensions.push(extension);
          });
        }
      }

    } else {
      runInAction(() => {
        const extension = this.getExtension(extensionId);
        if (extension) {
          extension.reloadRequire = reloadRequire;
          extension.installed = true;
          extension.enabled = true;
        }
      });
    }
    // 3. 标记为已安装
    await this.makeExtensionStatus(extensionId, {
      installed: true,
      enable: true,
      enableScope: EnableScope.GLOBAL,
      path,
    });
    // 安装插件后默认为全局启用、工作区间启用
    await this.enableExtensionToStorage(extensionId);
    this.eventBus.fire(new ExtensionChangeEvent({
      type: ExtensionChangeType.INSTALL,
      detail: extension,
    }));
    return path;
  }

  async installExtensionByReleaseId(releaseId: string) {
    const path = await this.extensionManagerServer.installExtensionByReleaseId(releaseId);
    // 在后台去启用插件
    await this.extensionService.postChangedExtension(false, path);
    const extensionProp = await this.extensionService.getExtensionProps(path);
    if (extensionProp) {
      const extension = await this.transformFromExtensionProp(extensionProp);
      // 添加到 extensions，下次获取 rawExtension
      runInAction(() => {
        this.extensions.push(extension);
      });
    }
    return path;
  }

  /**
   * 安装插件后的后置处理
   * @param extensionId
   * @param path
   */
  async onInstallExtension(extensionId: string, path: string) {
    // 在后台去启用插件
    await this.extensionService.postChangedExtension(false, path);
  }

  /**
   * 更新插件后热启用操作
   * @param path
   * @param oldExtensionPath
   */
  async onUpdateExtension(path: string, oldExtensionPath: string) {
    await this.extensionService.postChangedExtension(true, path, oldExtensionPath);
  }

  private async onUninstallExtension(path: string) {
    await this.extensionService.postUninstallExtension(path);
  }

  /**
   * 检查是否需要重启
   * @param extensionPath
   */
  async computeReloadState(extensionPath: string) {
    return await this.extensionService.isExtensionRunning(extensionPath);
  }

  @action
  async updateExtension(extension: BaseExtension, version: string): Promise<string> {
    const extensionId = extension.extensionId;
    const oldExtensionPath = extension.path;
    this.extensionMomentState.set(extensionId, {
      isUpdating: true,
    });
    const extensionPath =  await this.extensionManagerServer.updateExtension(extension, version);
    // 可能更新过程中加载了之前的插件，所以等待更新完毕后再去检测
    const reloadRequire = await this.computeReloadState(extension.path);
    runInAction(() => {
      const extension = this.getExtension(extensionId);
      if (extension) {
        extension.packageJSON.version = version;
        extension.isUseEnable = true;
        if (!reloadRequire) {
          extension.enabled = true;
        }
        extension.realPath = extension.path = extensionPath;
        extension.reloadRequire = reloadRequire;
      }
    });
    // 如果不需要重启，则激活新插件
    if (!reloadRequire) {
      await this.onUpdateExtension(extensionPath, oldExtensionPath);
    }
    return extensionPath;
  }

  /**
   * 比较两个插件 id 是否相等
   * 因为兼容性问题，线上返回的 extensionId 会是真实 id，需要比较 id 和 extensionId
   * @param extension
   * @param extensionId
   */
  private equalExtensionId(extension: RawExtension, extensionId: string): boolean {
    return extension.extensionId === extensionId || extension.id === extensionId;
  }

  private changeResultsState(results: RawExtension[], extensionId: string, state: Partial<RawExtension>) {
    return results.map((result) => {
      return this.equalExtensionId(result, extensionId) ? {
        ...result,
        ...state,
      } : result;
    });
  }

  @action
  async makeExtensionStatus(extensionId: string, state: Partial<RawExtension>) {
    this.searchMarketplaceResults = this.changeResultsState(this.searchMarketplaceResults, extensionId, state);
    this.hotExtensions = this.changeResultsState(this.hotExtensions, extensionId, state);
    this.searchInstalledResults = this.changeResultsState(this.searchInstalledResults, extensionId, state);

    this.extensionMomentState.set(extensionId, {
      isInstalling: false,
      isUpdating: false,
      isUnInstalling: false,
    });
  }

  /**
   * 转换 IExtensionProps 到 IExtension
   * @param extensionProps
   */
  private async transformFromExtensionProp(extensionProps: IExtensionProps[]): Promise<IExtension[]>;
  private async transformFromExtensionProp(extensionProps: IExtensionProps): Promise<IExtension>;
  private async transformFromExtensionProp(extensionProps: IExtensionProps[] | IExtensionProps): Promise<IExtension[] | IExtension> {
    if (Array.isArray(extensionProps)) {
      return await Promise.all(extensionProps.map(async (extension) => {
        return {
          ...extension,
          installed: true,
          enableScope: await this.getEnableScope(extension.extensionId),
        };
      }));
    } else {
      return {
        ...extensionProps,
        installed: true,
        enableScope: await this.getEnableScope(extensionProps.extensionId),
      };
    }
  }

  @action
  async init() {
    if (this.isInit) {
      return;
    }
    // 设置插件市场国际化
    await this.extensionManagerServer.setHeaders({
      'x-language-id': getLanguageId(),
    });
    // 获取所有已安装的插件
    const extensionProps = await this.extensionService.getAllExtensionJson();
    const extensions = await this.transformFromExtensionProp(extensionProps);
    // 是否要展示内置插件
    this.isShowBuiltinExtensions = await this.extensionManagerServer.isShowBuiltinExtensions();
    runInAction(() => {
      this.extensions = extensions;
    });
    await this.loadHotExtensions();
    runInAction(() => {
      this.isInit = true;
    });
  }

  @computed
  get enableResults() {
    return this.showExtensions.filter((extension) => extension.enable);
  }

  @computed
  get disableResults() {
    return this.showExtensions.filter((extension) => !extension.enable);
  }

  /**
   * 要展示的插件列表
   *
   * @readonly
   * @memberof ExtensionManagerService
   */
  @computed
  get showExtensions() {
    return this.rawExtension.filter((extension) => extension.isBuiltin ? extension.isBuiltin === this.isShowBuiltinExtensions : true);
  }

  @computed
  get rawExtension() {
    return this.extensions.map((extension) => {
      const { displayName, description } = this.getI18nInfo(extension);
      const [publisher, name] = extension.extensionId.split('.');
      return {
        id: extension.id,
        extensionId: extension.extensionId,
        // 说明加载的是新规范的插件，则用插件市场 name packageJSON 的 name
        name: name ? name : extension.packageJSON.name,
        displayName,
        version: extension.packageJSON.version,
        description,
        // 说明加载的是新规范的插件，则用插件市场 publisher，否则用 packageJSON 的 publisher
        publisher: name ? publisher : extension.packageJSON.publisher,
        installed: extension.installed,
        icon: this.getIconFromExtension(extension),
        path: extension.realPath,
        enable: extension.isUseEnable,
        isBuiltin: extension.isBuiltin,
        reloadRequire: extension.reloadRequire,
        enableScope: extension.enableScope,
        engines: {
          vscode: extension.packageJSON.engines?.vscode,
          kaitian: '',
        },
      };
    });
  }

  getRawExtensionById(extensionId: string): RawExtension | undefined {
    return this.rawExtension.find((extension) => this.equalExtensionId(extension, extensionId));
  }

  /**
   * 获取所有是依赖项并且当前是激活状态的扩展
   * A 是 B 的依赖，A 当前被激活
   * C 是 D 的依赖，D 当前没被激活
   * E 并非别人的依赖，E 当前被激活
   *
   * 则 return 的结果为 A - B
   *
   */
  public async getEnabledDeps(): Promise<Map<string, string[]>> {
    const activeExtsDeps = new Map();
    for (const installId of this.installedIds) {
      const detail = this.getRawExtensionById(installId);
      if (detail && detail.enable) {
        const extProp = await this.extensionService.getExtensionProps(detail.path);
        extProp?.packageJSON?.extensionDependencies?.forEach((dep) => {
          const depId = typeof dep === 'string' ? dep : Object.keys(dep)[0];
          // key 插件，value：被哪个插件依赖
          activeExtsDeps.set(depId, extProp.extensionId);
        });
      }
    }
    return activeExtsDeps;
  }

  /**
   * 如果 A 是 B 的依赖扩展，激活 B 的时候，应该先激活 A
   */
  private async beforeActiveExt(extension: BaseExtension, enable: boolean, scope: EnableScope ) {
    // TODO fix cycle loop
    const extensionId = extension.extensionId;

    const allExtsDependedMap = (await this.extensionService.getDependenciesExtMap());
    const allExtsDependedList = allExtsDependedMap.get(extensionId) || [];

    for (const dependedExtId of allExtsDependedList) {
      const detail = this.getRawExtensionById(dependedExtId);
      await this.toggleActiveExtension({
        extensionId: detail?.extensionId,
        name: detail?.name,
        version: detail?.version,
        path: detail?.path,
        publisher: detail?.publisher,
        isBuiltin: !!detail?.isBuiltin,
      } as BaseExtension , true, scope);
    }
  }

  @action
  async toggleActiveExtension(extension: BaseExtension, enable: boolean, scope: EnableScope) {

    const extensionId = extension.extensionId;

    if (enable) {
      // 激活当前插件前，先激活当前插件的依赖插件
      this.beforeActiveExt(extension, enable, scope);
    } else {
      // 禁用当前插件前，先检查当前要禁用的扩展如果是被其他已启用的组件所依赖，那么当前插件不应该被禁用
      const allEnabledDeps = await this.getEnabledDeps();
      if (Array.from(allEnabledDeps.keys()).includes(extension.extensionId)) {
        this.messageService.error(
          formatLocalize('marketplace.extension.disabled.failed.depended', extension.name, allEnabledDeps.get(extension.extensionId)),
        );
        return;
      }
    }

    const reloadRequire = await this.computeReloadState(extension.path);
    await this.setExtensionEnable(extensionId, enable, scope);
    // 如果需要重启，后续操作不进行启用、禁用
    if (!reloadRequire) {
      if (!enable) {
        await this.onDisableExtension(extension.path);
      } else {
        await this.onEnableExtension(extension.path);
      }
    }
    // 更新插件状态
    runInAction(() => {
      const extension = this.getExtension(extensionId);
      if (extension) {
        extension.isUseEnable = enable;
        extension.reloadRequire = reloadRequire;
        extension.enableScope = scope;
      }
    });
    // 在搜索结果面板也更新结果
    await this.makeExtensionStatus(extension.extensionId, {
      enable,
      reloadRequire,
      enableScope: scope,
    });
    this.eventBus.fire(new ExtensionChangeEvent({
      type: enable ? ExtensionChangeType.ENABLE : ExtensionChangeType.DISABLE,
      detail: extension,
    }));
  }

  async onDisableExtension(extensionPath: string) {
    await this.extensionService.postDisableExtension(extensionPath);
  }

  async onEnableExtension(extensionPath) {
    await this.extensionService.postEnableExtension(extensionPath);
  }

  async getDetailById(extensionId: string): Promise<ExtensionDetail | undefined> {
    const extension = this.getRawExtensionById(extensionId);
    if (!extension) {
      return;
    }
    const extensionDetail = await this.extensionService.getExtensionProps(extension.path, {
      readme: './README.md',
      changelog: './CHANGELOG.md',
      packageJSON: './package.json',
    });
    if (extensionDetail) {
      return {
        ...extension,
        readme: extensionDetail.extraMetadata.readme,
        changelog: extensionDetail.extraMetadata.changelog,
        packageJSON: extensionDetail?.packageJSON,
        license: '',
        categories: '',
        repository: extensionDetail.packageJSON.repository ? extensionDetail.packageJSON.repository.url : '',
        enableScope: await this.getEnableScope(extension.extensionId),
        contributes: {
          a: '',
        },
      };
    }
  }

  async getDetailFromMarketplace(extensionId: string, version?: string): Promise<ExtensionDetail | undefined> {
    const res = await this.extensionManagerServer.getExtensionFromMarketPlace(extensionId, version);
    if (res && res.data) {
      // TODO add packageJSON field
      // @ts-ignore
      return {
        id: `${res.data.publisher}.${res.data.name}`,
        extensionId: `${res.data.publisher}.${res.data.name}`,
        name: res.data.name,
        displayName: res.data.displayName,
        version: res.data.version,
        description: res.data.description,
        publisher: res.data.publisher,
        installed: false,
        icon: res.data.icon || DEFAULT_ICON_URL,
        path: '',
        enable: false,
        enableScope: EnableScope.GLOBAL,
        engines: {
          vscode: '',
          kaitian: '',
        },
        readme: res.data.readme,
        changelog: res.data.changelog,
        license: res.data.licenseUrl,
        repository: res.data.repository,
        contributes: res.data.contributes,
        categories: '',
        isBuiltin: false,
        reloadRequire: false,
        downloadCount: res.data.downloadCount || 0,
      };
    }
  }

  /**
   * 插件部分信息是 i18n 的，需要做层转换
   * @param extension
   */
  private getI18nInfo(extension: IExtension): { description: string, displayName: string} {
    let displayName;
    let description;

    displayName = replaceLocalizePlaceholder(extension.packageJSON.displayName, extension.id) ||
      extension.packageNlsJSON && extension.packageNlsJSON.displayName ||
      extension.defaultPkgNlsJSON && extension.defaultPkgNlsJSON.displayName ||
      extension.packageJSON.displayName;
    description = replaceLocalizePlaceholder(extension.packageJSON.description, extension.id) ||
      extension.packageNlsJSON && extension.packageNlsJSON.description ||
      extension.defaultPkgNlsJSON && extension.defaultPkgNlsJSON.description ||
      extension.packageJSON.description;

    return {
      description,
      displayName,
    };

  }

  private getIconFromExtension(extension: IExtension): string {
    const icon = extension.packageJSON.icon
              ? this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.realPath).join(extension.packageJSON.icon).toString())).toString()
              : DEFAULT_ICON_URL;
    return icon;
  }

  @action
  async uninstallExtension(extension: BaseExtension): Promise<boolean> {
    const dependedExtsMap = await this.extensionService.getDependedExtMap();
    const dependedExtIds = Array.from(dependedExtsMap.keys());
    const depended = dependedExtIds.find((depsId) => depsId === extension.extensionId);

    // 如果此插件是其他插件的依赖项，则不给卸载
    if (depended) {
        this.messageService.error(formatLocalize('marketplace.extension.uninstall.failed.depended', extension.name, dependedExtsMap.get(extension.extensionId)?.join(',')));
        return false;
    }

    const extensionPath = extension.path;
    const extensionId = extension.extensionId;
    this.extensionMomentState.set(extension.extensionId, {
      isUnInstalling: true,
    });
    // 如果删除成功，且不需要重启，在列表页删除
    const reloadRequire = await this.computeReloadState(extension.path);
    // 调用后台删除插件
    const res =  await this.extensionManagerServer.uninstallExtension(extension);
    if (res) {
      await this.onUninstallExtension(extensionPath);
      await this.removeExtensionConfig(extension.extensionId);
      if (!reloadRequire) {
        runInAction(() => {
          this.extensions = this.extensions.filter((extension) => extension.path !== extensionPath);
        });
      } else {
        runInAction(() => {
          const extension = this.getExtension(extensionId);
          if (extension) {
            extension.reloadRequire = reloadRequire;
            extension.installed = false;
          }
        });
      }
      // 卸载的插件默认设置为启动
      await this.enableExtensionToStorage(extensionId);
      // 修改插件状态
      await this.makeExtensionStatus(extension.extensionId, {
        installed: false,
        enable: false,
        reloadRequire,
      });
    }
    this.eventBus.fire(new ExtensionChangeEvent({
      type: ExtensionChangeType.UNINSTALL,
      detail: extension,
    }));
    return res;
  }

  /**
   * 获取所有安装插件 id
   * @readonly
   * @public
   * @memberof ExtensionManagerService
   */
  public get installedIds() {
    return this.extensions.map((extension) => extension.extensionId);
  }

  /**
   * 获取所有 enable 插件
   * @readonly
   * @public
   * @memberof ExtensionManagerService
   */
  public get useEnabledIds() {
    return this.extensions.filter((ext) => ext.isUseEnable).map((ext) => ext.extensionId);
  }

  /**
   * 设置插件开启
   * @param extensionId
   */
  private async enableExtensionToStorage(extensionId: string) {
    await Promise.all([
      this.setExtensionEnable(extensionId, true, EnableScope.GLOBAL),
      this.setExtensionEnable(extensionId, true, EnableScope.WORKSPACE),
    ]);
  }

  /**
   * 设置插件是否启用
   * 全局设置会影响到工作空间的设置
   * @param extensionId 插件  id
   * @param enable 是否启用
   * @param scope 作用范围
   */
  private async setExtensionEnable(extensionId: string, enable: boolean, scope: EnableScope) {
    const workspaceStorage = await this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS);
    if (scope === EnableScope.GLOBAL) {
      const globalStorage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS);
      globalStorage.set(extensionId, enable ? EXTENSION_ENABLE.ENABLE : EXTENSION_ENABLE.DISABLE);
    }
    workspaceStorage.set(extensionId, enable ? EXTENSION_ENABLE.ENABLE : EXTENSION_ENABLE.DISABLE);
  }

  /**
   * 从存储中移除插件
   * @param extensionId
   */
  private async removeExtensionConfig(extensionId: string) {
    const [ globalStorage, workspaceStorage ] = await Promise.all([
      this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS),
      this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS),
    ]);
    globalStorage.delete(extensionId);
    workspaceStorage.delete(extensionId);
  }

  /**
   * 获取插件启用范围
   * 如果全局和工作区间状态一致，则全局，否则是工作区间级别
   * @param extensionId 插件 id
   */
  private async getEnableScope(extensionId: string): Promise<EnableScope> {
    const [ globalStorage, workspaceStorage ] = await Promise.all([
      this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS),
      this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS),
    ]);
    if (workspaceStorage.get(extensionId) === undefined ||
        globalStorage.get(extensionId) === workspaceStorage.get(extensionId)) {
      return EnableScope.GLOBAL;
    } else {
      return EnableScope.WORKSPACE;
    }
  }

  /**
   * 转换插件市场的数据到 RawExtension
   * @param extension
   */
  private transformMarketplaceExtension(extension: SearchExtension): RawExtension {
    return {
      id: `${extension.publisher}.${extension.name}`,
      extensionId: `${extension.publisher}.${extension.name}`,
      name: extension.name,
      displayName: extension.displayName,
      version: extension.version,
      description: extension.description,
      publisher: extension.publisher,
      downloadCount: extension.downloadCount || 0,
      installed: false,
      icon: extension.icon || DEFAULT_ICON_URL,
      path: '',
      isBuiltin: false,
      enable: false,
      reloadRequire: false,
      enableScope: EnableScope.GLOBAL,
      engines: {
        vscode: '',
        kaitian: '',
      },
    };
  }

  private async getHotExtensions(ignoreId: string[]): Promise<RawExtension[]> {
    const res = await this.extensionManagerServer.getHotExtensions(ignoreId, this.hotPageIndex);
    if (res.count) {
      return res.data
        .map(this.transformMarketplaceExtension);
    } else {
      return [];
    }
  }

  @action
  public async loadHotExtensions() {
    if (this.loading === SearchState.LOADING || this.loading === SearchState.NO_MORE) {
      return;
    }
    this.loading = SearchState.LOADING;
    let hotExtensions: RawExtension[] = [];
    try {
      hotExtensions = await this.getHotExtensions(this.extensions.map((extensions) => extensions.extensionId));
      if (hotExtensions.length) {
        runInAction(() => {
          this.hotExtensions.push(...hotExtensions);
          this.loading = SearchState.LOADED;
          this.hotPageIndex++;
        });
      } else {
        runInAction(() => {
          this.loading = SearchState.NO_MORE;
        });
      }
    } catch (err) {
      this.logger.error(err);
      if (this.hotPageIndex === 1) {
        runInAction(() => {
          this.loading = SearchState.NO_CONTENT;
        });
      }
    }
  }

  /**
   * 设置插件市场请求的 headers
   * @param requestHeaders
   */
  async setRequestHeaders(requestHeaders: RequestHeaders) {
    await this.extensionManagerServer.setHeaders(requestHeaders);
  }

  openExtensionDetail(options: OpenExtensionOptions) {
    const query = `extensionId=${options.publisher}.${options.name}&version=${options.version}&name=${options.displayName || options.name}&icon=${options.icon}`;
    // 当打开模式为双击同时预览模式生效时，默认单击为预览
    const editorOptions = {
      preview: this.editorPreferences['editor.previewMode'] && options.preview,
    };
    if (options.remote) {
      this.workbenchEditorService.open(new URI(`extension://remote?${query}`), editorOptions);
    } else {
      this.workbenchEditorService.open(new URI(`extension://local?${query}`), editorOptions);
    }
  }
}
