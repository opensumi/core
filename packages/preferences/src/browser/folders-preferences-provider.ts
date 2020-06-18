import { Autowired, Injectable, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { URI, PreferenceProvider, PreferenceResolveResult, PreferenceConfigurations, ILogger, Deferred, Disposable, PreferenceProviderDataChanges, Emitter, Event } from '@ali/ide-core-browser';
import { FolderPreferenceProvider, FolderPreferenceProviderFactory, FolderPreferenceProviderOptions } from './folder-preference-provider';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';

@Injectable()
export class FoldersPreferencesProvider extends PreferenceProvider {

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private folderProviders = new Map<string, FolderPreferenceCollectionProvider>();

  @Autowired(ILogger)
  logger: ILogger;

  constructor() {
    super();
    this.init();
  }

  protected async init(): Promise<void> {
    await this.workspaceService.roots;

    this.updateProviders();
    this.workspaceService.onWorkspaceChanged(() => this.updateProviders());

    const readyPromises: Promise<void>[] = [];
    for (const provider of this.folderProviders.values()) {
      readyPromises.push(provider.ready.catch((e) => this.logger.error(e)));
    }
    Promise.all(readyPromises).then(() => this._ready.resolve());
  }

  protected updateProviders(): void {
    const roots = this.workspaceService.tryGetRoots();
    const toDelete = new Set(this.folderProviders.keys());
    for (const folder of roots) {
      const folderUri = new URI(folder.uri);
      const key = folderUri.toString();
      toDelete.delete(key);
      if (!this.folderProviders.has(key)) {
        const provider = this.injector.get(FolderPreferenceCollectionProvider, [folder]);
        provider.onDidPreferencesChanged((changes) => {
          if (!provider.isMainWorkspace()) {
            // 作为folder scope 的 provider， 只转发 folder 的change
            this.emitPreferencesChangedEvent(changes);
          }
        });
        this.folderProviders.set(key, provider);
      }
      const provider = this.folderProviders.get(key)!;
      if (this.workspaceService.workspace && this.workspaceService.workspace.uri === key) {
        provider.setIsMainWorkspace(true);
      } else {
        provider.setIsMainWorkspace(false);
      }
      provider.updateProviders();
      provider.init();
    }
    for (const key of toDelete) {
      const provider = this.folderProviders.get(key);
      if (provider) {
        this.folderProviders.delete(key);
        provider.dispose();
      }
    }
  }

  getConfigUri(resourceUri?: string): URI | undefined {
    const provider = this.getFolderProvider(resourceUri);
    return provider?.getConfigUri();
  }

  getDomain(): string[] {
    return this.workspaceService.tryGetRoots().map((root) => root.uri);
  }

  doResolve<T>(preferenceName: string, resourceUri?: string, language?: string): PreferenceResolveResult<T> {
    return this.getFolderProvider(resourceUri)?.doResolve(preferenceName, resourceUri, language) || {};
  }

  getPreferences(resourceUri?: string, language?: string): { [p: string]: any } {
    return this.getFolderProvider(resourceUri)?.getPreferences(language) || {};
  }

  getLanguagePreferences(resourceUri?: string) {
    return this.getFolderProvider(resourceUri)?.getLanguagePreferences() || {};
  }

   async doSetPreference(preferenceName: string, value: any, resourceUri?: string, language?: string): Promise<boolean> {
    const provider = this.getFolderProvider(resourceUri);
    if (!provider) {
      return false;
    } else {
      return provider.doSetPreference(preferenceName, value, resourceUri, language);
    }
  }

  public getDefaultFolderProvider(): FolderPreferenceCollectionProvider | undefined {
    for (const provider of this.folderProviders.values()) {
      if (provider.isMainWorkspace()) {
        return provider;
      }
    }
    return Array.from(this.folderProviders.values())[0];
  }

  protected getFolderProvider(resourceUri?: string): FolderPreferenceCollectionProvider | undefined {
    if (!resourceUri) {
      return undefined;
    }
    const resourcePath = new URI(resourceUri).path;
    let folder: Readonly<{ relativity: number, uri?: string }> = { relativity: Number.MAX_SAFE_INTEGER };
    for (const provider of this.folderProviders.values()) {
      const uri = provider.folderUri.toString();
      const relativity = provider.folderUri.path.relativity(resourcePath);
      if (relativity >= 0 && folder.relativity > relativity) {
        folder = { relativity, uri };
      }
    }
    return folder.uri ? this.folderProviders.get(folder.uri) : undefined;
  }

}

type SettingsFileUri = string;
type SectionName = string;
/**
 * 代表一个文件夹下， 多个 folder-file-preference (FolderPreferenceProvider) 的集合
 */
@Injectable({multiple: true})
export class FolderPreferenceCollectionProvider extends Disposable {

  @Autowired(FolderPreferenceProviderFactory)
  protected readonly folderPreferenceProviderFactory: FolderPreferenceProviderFactory;

  private providers = new Map<SettingsFileUri, FolderPreferenceProvider>();

  private cachedProvidersByConfigName: Map<SectionName, FolderPreferenceProvider[]>;

  private readonly onDidPreferencesChangedEmitter = new Emitter<PreferenceProviderDataChanges>();
  public readonly onDidPreferencesChanged: Event<PreferenceProviderDataChanges> = this.onDidPreferencesChangedEmitter.event;

  @Autowired(PreferenceConfigurations)
  protected readonly configurations: PreferenceConfigurations;

  @Autowired(ILogger)
  logger: ILogger;

  private _isMainWorkspace: boolean = false;

  private _ready = new Deferred<void>();

  public readonly ready = this._ready.promise;

  public readonly folderUri: URI;

  constructor(private folder: FileStat) {
    super();
    this.folderUri = new URI(this.folder.uri);
  }

  public isMainWorkspace() {
    return this._isMainWorkspace;
  }

  public setIsMainWorkspace(isMain: boolean) {
    this._isMainWorkspace = isMain;
    this.getProviders().forEach((p) => {
      p.setIsMain(isMain);
    });
  }

  init() {
    const readyPromises: Promise<void>[] = [];
    for (const provider of this.providers.values()) {
      readyPromises.push(provider.ready.catch((e) => this.logger.error(e)));
    }
    Promise.all(readyPromises).then(() => this._ready.resolve());
  }

  getProviders(): FolderPreferenceProvider[] {
    return Array.from(this.providers.values());
  }

  getConfigUri(resourceUri?: string): URI | undefined {
    for (const provider of this.providers.values()) {
      const configUri = provider.getConfigUri(resourceUri);
      if (this.configurations.isConfigUri(configUri)) {
        return configUri;
      }
    }
    return undefined;
  }

  getPreferences(language?: string): { [p: string]: any } {
    let result = {};
    const groups = this.groupProvidersByConfigName();
    for (const group of groups.values()) {
      for (const provider of group) {
        // 这里实际上只取了这一个, 实际上同一个section只有一个生效
        // 一个section多个provider的情况源自本来考虑对 .vscode 和 .kaitian 都能起效果的场景
        // 但目前这种场景应该不再使用.
        // 暂时保留原来的逻辑
        const preferences = provider.getPreferences(undefined, language);
        result = PreferenceProvider.merge(result, preferences) as any;
        break;
      }
    }
    return result;
  }

  protected groupProvidersByConfigName(): Map<string, FolderPreferenceProvider[]> {
    if (this.cachedProvidersByConfigName) {
      return this.cachedProvidersByConfigName;
    }
    this.cachedProvidersByConfigName = new Map<string, FolderPreferenceProvider[]>();
    const providers = this.getProviders();
    for (const configName of [this.configurations.getConfigName(), ...this.configurations.getSectionNames()]) {
      const group: any[] = [];
      for (const provider of providers) {
        if (this.configurations.getName(provider.getConfigUri()) === configName) {
          group.push(provider);
        }
      }
      this.cachedProvidersByConfigName.set(configName, group);
    }
    return this.cachedProvidersByConfigName;
  }

  getLanguagePreferences() {
    let result = {};
    const groups = this.groupProvidersByConfigName();
    for (const group of groups.values()) {
      for (const provider of group) {
        const preferences = provider.getLanguagePreferences();
        result = PreferenceProvider.merge(result, preferences) as any;
        break;
      }
    }
    return result;
  }

  doResolve<T>(preferenceName: string, resourceUri?: string, language?: string): PreferenceResolveResult<T> {
    const result: PreferenceResolveResult<T> = {};
    const groups = this.groupProvidersByConfigName();
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

  updateProviders(): void {
     const toDelete = new Set(this.providers.keys());
     for (const configPath of this.configurations.getPaths()) {
      for (const configName of [...this.configurations.getSectionNames(), this.configurations.getConfigName()]) {
        const configUri = this.configurations.createUri(this.folderUri, configPath, configName);
        const key = configUri.toString();
        toDelete.delete(key);
        if (!this.providers.has(key)) {
          const provider = this.createProvider({ folder: this.folder, configUri });
          this.addDispose(provider);
          this.providers.set(key, provider);
        }
        this.providers.get(key)?.setIsMain(this.isMainWorkspace());
      }
    }
     for (const key of toDelete) {
      const provider = this.providers.get(key);
      if (provider) {
        this.providers.delete(key);
        provider.dispose();
      }
    }
  }

  async doSetPreference(preferenceName: string, value: any, resourceUri?: string, language?: string): Promise<boolean> {
    const sectionName = preferenceName.split('.', 1)[0];
    const configName = this.configurations.isSectionName(sectionName) ? sectionName : this.configurations.getConfigName();

    const providers = this.groupProvidersByConfigName().get(configName);
    if (providers && providers.length > 0 ) {
      // FIXME: 这里用do是因为不想再过 delegate 逻辑，
      // 照理说 folderFilePreferenceProvider（AbstractResourcePreferenceProvider) 不应该去继承 preferenceProvider,
      // PreferenceProvider的含义应该是带有Scope属性的，被PreferenceService引用的Provider
      // 未来再改掉
      try {
        await providers[0].doSetPreference(preferenceName, value, resourceUri, language);
        return true;
      } catch (e) {
        this.logger.error(e);
        return false;
      }
    } else {
      return false;
    }
    /*
      以下原来的实现来自 theia, 完全不明所以，deprecated
    */
    // for (const provider of providers) {
    //   if (configPath === undefined) {
    //     const configUri = provider.getConfigUri(resourceUri);
    //     if (configUri) {
    //       configPath = this.configurations.getPath(configUri);
    //     }
    //   }
    //   if (this.configurations.getName(provider.getConfigUri()) === configName) {
    //     iterator.push(() => {
    //       if (provider.getConfigUri(resourceUri)) {
    //         return provider;
    //       }
    //       iterator.push(() => {
    //         if (this.configurations.getPath(provider.getConfigUri()) === configPath) {
    //           return provider;
    //         }
    //         iterator.push(() => provider);
    //       });
    //     });
    //   }
    // }

    // let next = iterator.shift();
    // while (next) {
    //   const provider = next();
    //   if (provider) {
    //     if (await provider.setPreference(preferenceName, value, resourceUri, language)) {
    //       return true;
    //     }
    //   }
    //   next = iterator.shift();
    // }
    // return false;
  }

  protected createProvider(options: FolderPreferenceProviderOptions): FolderPreferenceProvider {
    const provider = this.folderPreferenceProviderFactory(options);
    this.addDispose(provider);
    this.addDispose(provider.onDidPreferencesChanged((change) => this.onDidPreferencesChangedEmitter.fire(change)));
    return provider;
  }

}
