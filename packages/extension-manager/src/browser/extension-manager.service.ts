import { Injectable, Autowired } from '@ali/common-di';
import { IExtensionManagerService, RawExtension, ExtensionDetail, ExtensionManagerServerPath, IExtensionManagerServer, DEFAULT_ICON_URL, SearchState } from '../common';
import { ExtensionService, IExtensionProps } from '@ali/ide-kaitian-extension/lib/common';
import { action, observable, computed, runInAction } from 'mobx';
import { Path } from '@ali/ide-core-common/lib/path';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { URI, ILogger, replaceLocalizePlaceholder, debounce } from '@ali/ide-core-browser';

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

  @observable
  extensions: IExtensionProps[] = [];

  @observable
  loading: boolean = false;

  @observable
  searchState: SearchState = SearchState.LOADED;

  @observable
  searchResults: RawExtension[] = [];

  private isInit: boolean = false;

  // 是否显示内置插件
  private isShowBuiltinExtensions: boolean = false;

  @action
  search(query: string) {
    this.searchState = SearchState.LOADING;
    this.searchResults = [];
    this.searchExtensionFromMarketplace(query);
  }

  @action
  @debounce(300)
  private async searchExtensionFromMarketplace(query: string) {
    try {
      const res = await this.extensionManagerServer.search(query);

      if (res.count > 0) {

        const data = res.data
        // 排除掉内置插件
        .filter((extension) => !this.isBuiltin(extension.extensionId))
        .map((extension) => ({
          id: `${extension.publisher}.${extension.name}`,
          extensionId: extension.extensionId,
          name: extension.name,
          displayName: extension.displayName,
          version: extension.version,
          description: extension.description,
          publisher: extension.publisher,
          installed: this.isInstalled(extension.extensionId),
          icon: extension.icon || DEFAULT_ICON_URL,
          path: '',
        }));
        runInAction(() => {
          this.searchResults = data;
          this.searchState = SearchState.LOADED;
        });
      } else {
        runInAction(() => {
          this.searchState = SearchState.NO_CONTENT;
        });
      }

    } catch (err) {
      this.logger.error(err);
      runInAction(() => {
        this.searchState = SearchState.NO_CONTENT;
      });
    }
  }

  async downloadExtension(extensionId: string, version?: string): Promise<string> {
    return await this.extensionManagerServer.downloadExtension(extensionId, version);
  }

  onInstallExtension(extensionId: string, path: string) {
    this.extensionService.postChangedExtension(extensionId, path);
  }

  onUpdateExtension(extensionId: string, path: string) {
    this.extensionService.postChangedExtension(extensionId, path);
  }

  async computeReloadState(extensionPath: string) {
    const reloadRequire = await this.extensionService.isExtensionRunning(extensionPath);
    return reloadRequire;
  }

  async updateExtension( extensionId: string, version: string, oldExtensionPath: string ): Promise<boolean> {
    return await this.extensionManagerServer.updateExtension(extensionId, version, oldExtensionPath);
  }

  @action
  async init() {
    // 获取所有已安装的插件
    const extensions = await this.extensionService.getAllExtensionJson();
    // 是否要展示内置插件
    this.isShowBuiltinExtensions = await this.extensionManagerServer.isShowBuiltinExtensions();
    this.extensions = extensions;
    this.loading = false;
    this.isInit = true;
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
  get showExtensions() {
    return this.rawExtension.filter((extension) => extension.isBuiltin ? extension.isBuiltin === this.isShowBuiltinExtensions : true);
  }

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

  async toggleActiveExtension(extensionId: string, enable: boolean) {
    await this.extensionService.setExtensionEnable(extensionId, enable);
  }

  async onDisableExtension(extensionPath) {
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
      const readme = extensionDetail.extraMetadata.readme
                  ? extensionDetail.extraMetadata.readme
                  : `# ${extension.displayName}\n${extension.description}`;

      const changelog = extensionDetail.extraMetadata.changelog
                  ? extensionDetail.extraMetadata.changelog
                  : `no changelog`;
      return {
        ...extension,
        readme,
        changelog,
        license: '',
        categories: '',
        contributes: {
          a: '',
        },
      };
    }
  }

  async getDetailFromMarketplace( extensionId: string ): Promise<ExtensionDetail | undefined> {
    const res = await this.extensionManagerServer.getExtensionFromMarketPlace(extensionId);

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
        engines: {
          vscode: '',
          kaitian: '',
        },
        readme: res.data.readme,
        changelog: res.data.changelog,
        license: res.data.licenseUrl,
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
  private getI18nInfo(extension: IExtensionProps): { description: string, displayName: string} {
    let displayName = extension.packageJSON.displayName;
    let description = extension.packageJSON.description;

    if (extension.extraMetadata.languageBundle) {
      try {
        const language = JSON.parse(extension.extraMetadata.languageBundle);
        displayName = replaceLocalizePlaceholder(language.displayName);
        description = replaceLocalizePlaceholder(language.description);
      } catch (e) {
        this.logger.error('parse languageBundle throw a Error', e.message);
      }
    }

    return {
      description,
      displayName,
    };

  }

  private getIconFromExtension(extension: IExtensionProps): string {
    const icon = extension.packageJSON.icon
              ? this.staticResourceService.resolveStaticResource(URI.file(new Path(extension.realPath).join(extension.packageJSON.icon).toString())).toString()
              : DEFAULT_ICON_URL;
    return icon;
  }

  uninstallExtension(extensionPath: string): Promise<boolean> {
    const res =  this.extensionManagerServer.uninstallExtension(extensionPath);
    // 如果删除成功，在列表页删除
    if (res) {
      this.extensions = this.extensions.filter((extension) => extension.path !== extensionPath);
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
   * 获取内置插件的 id
   * @readonly
   * @private
   * @memberof ExtensionManagerService
   */
  private get builtinIds() {
    return this.extensions.filter((extension) => extension.isBuiltin).map((extension) => extension.extensionId);
  }

  /**
   * 判断是否是内置插件
   * @param extensionId 插件 id
   */
  private isBuiltin(extensionId: string): boolean {
    return this.builtinIds.includes(extensionId);
  }

  /**
   * 判断插件是否已安装
   * @param extensionId 插件 id
   */
  private isInstalled(extensionId: string): boolean {
    return this.installedIds.includes(extensionId);
  }
}
