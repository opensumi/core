import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IExtensionManagerService, RawExtension, ExtensionDetail, ExtensionManagerServerPath, IExtensionManagerServer, DEFAULT_ICON_URL, SearchState, EnableScope, TabActiveKey, hotExtensionsFromMarketplaceTarbarHandlerId, enableExtensionsContainerId, searchExtensionsFromMarketplaceTarbarHandlerId, enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId, searchExtensionsFromInstalledTarbarHandlerId, SearchExtension, RequestHeaders } from '../common';
import { ExtensionService, IExtensionProps } from '@ali/ide-kaitian-extension/lib/common';
import { action, observable, computed, runInAction } from 'mobx';
import { Path } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { URI, ILogger, replaceLocalizePlaceholder, debounce, StorageProvider, STORAGE_NAMESPACE, localize } from '@ali/ide-core-browser';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

// IExtensionProps 属性为 readonly，改为 writeable
type IExtension = Writeable<IExtensionProps>;

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

  private isInit: boolean = false;

  // 是否显示内置插件
  private isShowBuiltinExtensions: boolean = false;

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

  async downloadExtension(extensionId: string, version?: string): Promise<string> {
    return await this.extensionManagerServer.downloadExtension(extensionId, version);
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
    const reloadRequire = await this.extensionService.isExtensionRunning(extensionPath);
    return reloadRequire;
  }

  @action
  async updateExtension(extensionId: string, version: string, oldExtensionPath: string ): Promise<string> {
    const extensionPath =  await this.extensionManagerServer.updateExtension(extensionId, version, oldExtensionPath);
    runInAction(() => {
      const extension = this.extensions.find((extension) => extension.extensionId === extensionId);
      if (extension) {
        extension.packageJSON.version = version;
        extension.isUseEnable = true;
        extension.enabled = true;
        extension.path = extensionPath;
      }
    });
    return extensionPath;
  }

  @action
  async makeExtensionStatus(installed: boolean, extensionId: string, extensionPath: string) {
    this.searchMarketplaceResults = this.searchMarketplaceResults.map((r) => r.extensionId === extensionId ? {
      ...r,
      installed,
      enable: installed,
      path: extensionPath,
      } : r);
    this.hotExtensions = this.hotExtensions.map((r) => r.extensionId === extensionId ? {
      ...r,
      installed,
      enable: installed,
      path: extensionPath,
      } : r);
    const rawExt = this.searchMarketplaceResults.find((r) => r.extensionId === extensionId)
      || this.hotExtensions.find((r) => r.extensionId === extensionId);

    if (rawExt && installed) {
      const extension = await this.extensionService.getExtensionProps(extensionPath);
      if (extension) {
        // 添加到 extensions，下次获取 rawExtension
        runInAction(() => {
          this.extensions.push(extension);
        });
      }
    }
  }

  @action
  async init() {
    this.loading = SearchState.LOADING;
    // 获取所有已安装的插件
    const extensions = await this.extensionService.getAllExtensionJson();
    const hotExtensions = await this.getHotExtensions(extensions.map((extensions) => extensions.extensionId));
    // 是否要展示内置插件
    this.isShowBuiltinExtensions = await this.extensionManagerServer.isShowBuiltinExtensions();
    runInAction(() => {
      this.hotExtensions = hotExtensions;
      this.extensions = extensions;
      this.loading = SearchState.LOADED;
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

      return {
        id: extension.id,
        extensionId: extension.extensionId,
        name: extension.packageJSON.name,
        displayName,
        version: extension.packageJSON.version,
        description,
        publisher: extension.packageJSON.publisher,
        installed: true,
        icon: this.getIconFromExtension(extension),
        path: extension.realPath,
        enable: extension.isUseEnable,
        isBuiltin: extension.isBuiltin,
        engines: {
          vscode: extension.packageJSON.engines.vscode,
          kaitian: '',
        },
      };
    });
  }

  async getRawExtensionById(extensionId: string): Promise<RawExtension> {
    // 说明是刚进入页面看到了上次打开的插件详情窗口，需要先调用初始化
    if (!this.isInit) {
      await this.init();
    }

    return this.rawExtension.find((extension) => extension.extensionId === extensionId)!;
  }

  @action
  async toggleActiveExtension(extensionId: string, enable: boolean, scope: EnableScope) {
    await this.setExtensionEnable(extensionId, enable, scope);
    // 更新插件状态
    runInAction(() => {
      const extension = this.extensions.find((extension) => extension.extensionId === extensionId);
      if (extension) {
        extension.isUseEnable = enable;
      }
    });
  }

  async onDisableExtension(extensionPath: string) {
    await this.extensionService.postDisableExtension(extensionPath);
  }

  async onEnableExtension(extensionPath) {
    await this.extensionService.postEnableExtension(extensionPath);
  }

  async getDetailById(extensionId: string): Promise<ExtensionDetail | undefined> {

    const extension = await this.getRawExtensionById(extensionId);

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

  async getDetailFromMarketplace(extensionId: string, version: string): Promise<ExtensionDetail | undefined> {
    const res = await this.extensionManagerServer.getExtensionFromMarketPlace(extensionId, version);
    if (res && res.data) {
      return {
        id: `${res.data.publisher}.${res.data.name}`,
        extensionId: res.data.extensionId,
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

    displayName = localize('displayName', undefined, extension.id) || extension.packageJSON.displayName;
    description = localize('description', undefined, extension.id) || extension.packageJSON.description;

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
  async uninstallExtension(extensionId: string, extensionPath: string): Promise<boolean> {
    const res =  await this.extensionManagerServer.uninstallExtension(extensionPath);
    if (res) {
      // 如果删除成功，在列表页删除
      await this.removeExtensionConfig(extensionId);
      runInAction(() => {
        this.extensions = this.extensions.filter((extension) => extension.path !== extensionPath);
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
      extensionId: extension.extensionId,
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
