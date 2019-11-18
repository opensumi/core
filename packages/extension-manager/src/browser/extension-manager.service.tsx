import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IExtensionManagerService, RawExtension, ExtensionDetail, ExtensionManagerServerPath, IExtensionManagerServer, DEFAULT_ICON_URL, SearchState, EnableScope, TabActiveKey, SearchExtension, RequestHeaders, BaseExtension, ExtensionMomentState } from '../common';
import { ExtensionService, IExtensionProps } from '@ali/ide-kaitian-extension/lib/common';
import { action, observable, computed, runInAction } from 'mobx';
import { Path } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { URI, ILogger, replaceLocalizePlaceholder, debounce, StorageProvider, STORAGE_NAMESPACE, localize } from '@ali/ide-core-browser';
import { memoize, IDisposable, dispose, getLanguageId } from '@ali/ide-core-common';
import { IMenu, AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { IContextKeyService } from '@ali/ide-core-browser';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

// IExtensionProps 属性为 readonly，改为 writeable
type IExtension = Writeable<IExtensionProps> & {
  enableScope: EnableScope,
  reloadRequire?: boolean;
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

  @observable
  isInit: boolean = false;

  @observable contextMenu: IMenu;

  @observable
  extensionMomentState: Map<string, ExtensionMomentState> = new Map<string, ExtensionMomentState>();

  // 是否显示内置插件
  private isShowBuiltinExtensions: boolean = false;

  constructor() {
    // 创建 contextMenu
    this.contextMenu = this.menuService.createMenu(MenuId.ExtensionContext, this.contextKeyService);
    this.disposables.push(this.contextMenu);
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
      // 排除掉已安装的插件
      const res = await this.extensionManagerServer.search(query, this.installedIds);
      if (res.count > 0) {
        const data = res.data
        .map(this.transformMarketplaceExtension);
        runInAction(() => {
          this.searchMarketplaceResults = data;
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

  /**
   * 安装插件
   * @param extension 插件基础信息
   * @param version 指定版本
   */
  async installExtension(extension: BaseExtension, version?: string): Promise<string> {
    this.extensionMomentState.set(extension.extensionId, {
      isInstalling: true,
    });
    // 1. 调用后台下载插件
    const path = await this.extensionManagerServer.installExtension(extension, version || extension.version);
    // 2. 更新插件进程信息
    await this.onInstallExtension(extension.extensionId, path);
    // 3. 标记为已安装
    await this.makeExtensionStatus(extension.extensionId, {
      installed: true,
      enable: true,
      enableScope: EnableScope.GLOBAL,
      path,
    });
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
    // 安装插件后默认为全局启用、工作区间启用
    this.setExtensionEnable(extensionId, true, EnableScope.GLOBAL);
  }

  /**
   * 更新插件后热启用操作
   * @param path
   * @param oldExtensionPath
   */
  async onUpdateExtension(path: string, oldExtensionPath: string) {
    await this.extensionService.postChangedExtension(true, path, oldExtensionPath);
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
    this.extensionMomentState.set(extensionId, {
      isUpdating: true,
    });
    const extensionPath =  await this.extensionManagerServer.updateExtension(extension, version);
    const reloadRequire = await this.computeReloadState(extension.path);
    runInAction(() => {
      const extension = this.extensions.find((extension) => extension.extensionId === extensionId);
      if (extension) {
        extension.packageJSON.version = version;
        extension.isUseEnable = true;
        if (!reloadRequire) {
          extension.enabled = true;
        }
        extension.path = extensionPath;
        extension.reloadRequire = reloadRequire;
      }
    });
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
    const rawExt = this.searchMarketplaceResults.find((r) => this.equalExtensionId(r, extensionId))
      || this.hotExtensions.find((r) => this.equalExtensionId(r, extensionId))
      || this.searchInstalledResults.find((r) => this.equalExtensionId(r, extensionId));

    if (rawExt && state.installed && state.path) {
      const extensionProp = await this.extensionService.getExtensionProps(state.path);
      if (extensionProp) {
        const extension = await this.transformFromExtensionProp(extensionProp);
        // 添加到 extensions，下次获取 rawExtension
        runInAction(() => {
          this.extensions.push(extension);
          this.extensionMomentState.set(extension.extensionId, {
            isInstalling: false,
            isUpdating: false,
            isUnInstalling: false,
          });
        });
      }
    }
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
          enableScope: await this.getEnableScope(extension.extensionId),
        };
      }));
    } else {
      return {
        ...extensionProps,
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
    this.loading = SearchState.LOADING;
    // 获取所有已安装的插件
    const extensionProps = await this.extensionService.getAllExtensionJson();
    const extensions = await this.transformFromExtensionProp(extensionProps);
    let hotExtensions: RawExtension[] = [];
    try {
      hotExtensions = await this.getHotExtensions(extensions.map((extensions) => extensions.extensionId));
      runInAction(() => {
        this.hotExtensions = hotExtensions;
        this.loading = SearchState.LOADED;
      });
    } catch (err) {
      this.logger.error(err);
      runInAction(() => {
        this.loading = SearchState.NO_CONTENT;
      });
    }
    // 是否要展示内置插件
    this.isShowBuiltinExtensions = await this.extensionManagerServer.isShowBuiltinExtensions();
    runInAction(() => {
      this.extensions = extensions;
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
        installed: true,
        icon: this.getIconFromExtension(extension),
        path: extension.realPath,
        enable: extension.isUseEnable,
        isBuiltin: extension.isBuiltin,
        reloadRequire: extension.reloadRequire,
        enableScope: extension.enableScope,
        engines: {
          vscode: extension.packageJSON.engines.vscode,
          kaitian: '',
        },
      };
    });
  }

  getRawExtensionById(extensionId: string): RawExtension {
    return this.rawExtension.find((extension) => this.equalExtensionId(extension, extensionId))!;
  }

  @action
  async toggleActiveExtension(extension: BaseExtension, enable: boolean, scope: EnableScope) {
    const extensionId = extension.extensionId;
    await this.setExtensionEnable(extensionId, enable, scope);
    if (!enable) {
      await this.onDisableExtension(extension.path);
    } else {
      await this.onEnableExtension(extension.path);
    }
    const reloadRequire = await this.computeReloadState(extension.path);
    // 更新插件状态
    runInAction(() => {
      const extension = this.extensions.find((extension) => extension.extensionId === extensionId);
      if (extension) {
        if (!reloadRequire) {
          extension.isUseEnable = enable;
        }
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
  }

  async onDisableExtension(extensionPath: string) {
    await this.extensionService.postDisableExtension(extensionPath);
  }

  async onEnableExtension(extensionPath) {
    await this.extensionService.postEnableExtension(extensionPath);
  }

  async getDetailById(extensionId: string): Promise<ExtensionDetail | undefined> {
    const extension = this.getRawExtensionById(extensionId);
    const extensionDetail = await this.extensionService.getExtensionProps(extension.path, {
      readme: './README.md',
      changelog: './CHANGELOG.md',
    });
    if (extensionDetail) {
      return {
        ...extension,
        readme: extensionDetail.extraMetadata.readme,
        changelog: extensionDetail.extraMetadata.changelog,
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
      extension.deafaultPkgNlsJSON && extension.deafaultPkgNlsJSON.displayName ||
      extension.packageJSON.displayName;
    description = replaceLocalizePlaceholder(extension.packageJSON.description, extension.id) ||
      extension.packageNlsJSON && extension.packageNlsJSON.description ||
      extension.deafaultPkgNlsJSON && extension.deafaultPkgNlsJSON.description ||
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
    const extensionPath = extension.path;
    this.extensionMomentState.set(extension.extensionId, {
      isUnInstalling: true,
    });
    // 调用后台删除插件
    const res =  await this.extensionManagerServer.uninstallExtension(extension);

    if (res) {

      await this.removeExtensionConfig(extension.extensionId);
      // 如果删除成功，且不需要重启，在列表页删除
      const reloadRequire = await this.computeReloadState(extension.path);
      if (!reloadRequire) {
        runInAction(() => {
          this.extensions = this.extensions.filter((extension) => extension.path !== extensionPath);
        });
      }
      // 卸载的插件默认设置为启动
      await this.toggleActiveExtension(extension, true, EnableScope.GLOBAL);
      // 修改插件状态
      await this.makeExtensionStatus(extension.extensionId, {
        installed: false,
        enable: false,
        reloadRequire,
      });
    }
    return res;
  }

  /**
   * 获取所有安装插件 id
   * @readonly
   * @private
   * @memberof ExtensionManagerService
   */
  private get installedIds() {
    return this.extensions.map((extension) => extension.extensionId);
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
      globalStorage.set(extensionId, enable ? '1' : '0');
    }
    workspaceStorage.set(extensionId, enable ? '1' : '0');
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
    const res = await this.extensionManagerServer.getHotExtensions(ignoreId);
    if (res.count) {
      return res.data
        .map(this.transformMarketplaceExtension);
    } else {
      return [];
    }
  }

  /**
   * 设置插件市场请求的 headers
   * @param requestHeaders
   */
  async setRequestHeaders(requestHeaders: RequestHeaders) {
    await this.extensionManagerServer.setHeaders(requestHeaders);
  }
}
