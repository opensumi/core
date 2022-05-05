import { Autowired, Injectable } from '@opensumi/di';
import {
  URI,
  PreferenceProvider,
  PreferenceResolveResult,
  PreferenceConfigurations,
  ILogger,
} from '@opensumi/ide-core-browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  FolderPreferenceProvider,
  FolderPreferenceProviderFactory,
  FolderPreferenceProviderOptions,
} from './folder-preference-provider';
@Injectable()
export class FoldersPreferencesProvider extends PreferenceProvider {
  @Autowired(FolderPreferenceProviderFactory)
  protected readonly folderPreferenceProviderFactory: FolderPreferenceProviderFactory;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  protected readonly providers = new Map<string, FolderPreferenceProvider>();

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    await this.workspaceService.roots;

    this.updateProviders();
    this.workspaceService.onWorkspaceChanged(() => this.updateProviders());

    const readyPromises: Promise<void>[] = [];
    for (const provider of this.providers.values()) {
      readyPromises.push(provider.ready.catch((e) => this.logger.error(e)));
    }
    if (readyPromises.length > 0) {
      Promise.all(readyPromises).then(() => this._ready.resolve());
    } else {
      this._ready.resolve();
    }
  }

  /**
   * 根据当前工作区文件结构重新初始化配置项获取逻辑
   *
   * @protected
   * @memberof FoldersPreferencesProvider
   */
  protected updateProviders(): void {
    const roots = this.workspaceService.tryGetRoots();
    const toDelete = new Set(this.providers.keys());
    for (const folder of roots) {
      // 这里根据当前工作区的根目录分别创建setting.json文件的Provider
      const folderUri = new URI(folder.uri);
      for (const configPath of this.configurations.getPaths()) {
        for (const configName of [...this.configurations.getSectionNames(), this.configurations.getConfigName()]) {
          const configUri = this.configurations.createUri(folderUri, configPath, configName);
          const key = configUri.toString();
          toDelete.delete(key);
          if (!this.providers.has(key)) {
            const provider = this.createProvider({ folder, configUri });
            this.providers.set(key, provider);
          }
        }
      }
    }
    // 去重，移除旧的配置文件Provider
    for (const key of toDelete) {
      const provider = this.providers.get(key);
      if (provider) {
        this.providers.delete(key);
        provider.dispose();
      }
    }
  }

  getConfigUri(resourceUri?: string): URI | undefined {
    for (const provider of this.getFolderProviders(resourceUri)) {
      const configUri = provider.getConfigUri(resourceUri);
      if (this.configurations.isConfigUri(configUri)) {
        return configUri;
      }
    }
    return undefined;
  }

  getContainingConfigUri(resourceUri?: string): URI | undefined {
    for (const provider of this.getFolderProviders(resourceUri)) {
      const configUri = provider.getConfigUri();
      if (this.configurations.isConfigUri(configUri) && provider.contains(resourceUri)) {
        return configUri;
      }
    }
    return undefined;
  }

  getDomain(): string[] {
    return this.workspaceService.tryGetRoots().map((root) => root.uri);
  }

  doResolve<T>(preferenceName: string, resourceUri?: string, language?: string): PreferenceResolveResult<T> {
    const result: PreferenceResolveResult<T> = {};
    const groups = this.groupProvidersByConfigName(resourceUri);
    for (const group of groups.values()) {
      for (const provider of group) {
        const { value, configUri } = provider.resolve<T>(preferenceName, resourceUri, language);
        if (configUri && value !== undefined) {
          result.configUri = configUri;
          result.value = PreferenceProvider.merge(result.value as any, value as any) as any;
          break;
        }
      }
    }
    return result;
  }

  getPreferences(resourceUri?: string, language?: string) {
    let result;
    const groups = this.groupProvidersByConfigName(resourceUri);
    for (const group of groups.values()) {
      for (const provider of group) {
        if (provider.getConfigUri(resourceUri)) {
          const preferences = provider.getPreferences(undefined, language);
          if (preferences) {
            result = PreferenceProvider.merge(result, preferences) as any;
          }
          break;
        }
      }
    }
    return result;
  }

  getLanguagePreferences(resourceUri?: string) {
    let result;
    const groups = this.groupProvidersByConfigName(resourceUri);
    for (const group of groups.values()) {
      for (const provider of group) {
        if (provider.getConfigUri(resourceUri)) {
          const preferences = provider.getLanguagePreferences();
          if (preferences) {
            result = PreferenceProvider.merge(result, preferences) as any;
          }
          break;
        }
      }
    }
    return result;
  }

  /**
   * 根据传入的preferenceName对配置项进行值的更新
   * 这里一个配置项，如launch.json可能对应多个Provider，故需要遍历进行配置设置
   *
   * @param {string} preferenceName 配置项
   * @param {*} value 值
   * @param {string} [resourceUri] 资源路径
   * @param {string} [language] 语言标识符
   * @returns {Promise<boolean>}
   * @memberof FoldersPreferencesProvider
   */
  async doSetPreference(preferenceName: string, value: any, resourceUri?: string, language?: string): Promise<boolean> {
    const sectionName = preferenceName.split('.', 1)[0];
    const configName = this.configurations.isSectionName(sectionName)
      ? sectionName
      : this.configurations.getConfigName();

    const providers = this.getFolderProviders(resourceUri);
    let configPath: string | undefined;

    for (const provider of providers) {
      if (configPath === undefined) {
        const configUri = provider.getConfigUri(resourceUri);
        if (configUri) {
          configPath = this.configurations.getPath(configUri);
        }
      }
      if (this.configurations.getName(provider.getConfigUri()) === configName) {
        if (provider.getConfigUri(resourceUri)) {
          // 当存在配置文件路径时，尝试执行设置配置
          if (await provider.setPreference(preferenceName, value, resourceUri, language)) {
            return true;
          }
        } else if (this.configurations.getPath(provider.getConfigUri()) === configPath) {
          // 当存在配置文件父路径与当前传入的resourceUri所指定的配置文件父路径一致时，尝试执行设置配置
          if (await provider.setPreference(preferenceName, value, resourceUri, language)) {
            return true;
          }
        } else {
          // 为不存在配置文件的配置尝试执行一次配置修改
          if (await provider.setPreference(preferenceName, value, resourceUri, language)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  protected groupProvidersByConfigName(resourceUri?: string): Map<string, FolderPreferenceProvider[]> {
    const groups = new Map<string, FolderPreferenceProvider[]>();
    const providers = this.getFolderProviders(resourceUri);
    for (const configName of [this.configurations.getConfigName(), ...this.configurations.getSectionNames()]) {
      const group: any[] = [];
      for (const provider of providers) {
        if (this.configurations.getName(provider.getConfigUri()) === configName) {
          group.push(provider);
        }
      }
      groups.set(configName, group);
    }
    return groups;
  }

  protected getFolderProviders(resourceUri?: string): FolderPreferenceProvider[] {
    if (!resourceUri) {
      return [];
    }
    const resourcePath = new URI(resourceUri).path;
    let folder: Readonly<{ relativity: number; uri?: string }> = { relativity: Number.MAX_SAFE_INTEGER };
    const providers = new Map<string, FolderPreferenceProvider[]>();
    for (const provider of this.providers.values()) {
      const uri = provider.folderUri.toString();
      const folderProviders = providers.get(uri) || [];
      folderProviders.push(provider);
      providers.set(uri, folderProviders);
      const relativity = provider.folderUri.path.relativity(resourcePath);
      if (relativity >= 0 && folder.relativity > relativity) {
        folder = { relativity, uri };
      }
    }
    return (folder.uri && providers.get(folder.uri)) || [];
  }

  protected createProvider(options: FolderPreferenceProviderOptions): FolderPreferenceProvider {
    const provider = this.folderPreferenceProviderFactory(options);
    this.toDispose.push(provider);
    this.toDispose.push(
      provider.onDidPreferencesChanged((change) => {
        this.emitPreferencesChangedEvent(change);
      }),
    );
    return provider;
  }
}
