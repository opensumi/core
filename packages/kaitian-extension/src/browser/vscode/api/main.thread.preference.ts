import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadPreference, PreferenceData, PreferenceChangeExt } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { ConfigurationTarget } from '../../../common/vscode';
import { PreferenceService, PreferenceProviderProvider, PreferenceScope, DisposableCollection, PreferenceSchemaProvider } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat } from '@ali/ide-file-service';

export function getPreferences(preferenceProviderProvider: PreferenceProviderProvider, rootFolders: FileStat[]): PreferenceData {
  const folders = rootFolders.map((root) => root.uri.toString());
  return PreferenceScope.getScopes().reduce((result: { [key: number]: any }, scope: PreferenceScope) => {
    result[scope] = {};
    const provider = preferenceProviderProvider(scope);
    if (scope === PreferenceScope.Folder) {
      for (const f of folders) {
        const folderPrefs = provider.getPreferences(f);
        result[scope][f] = folderPrefs;
      }
    } else {
      result[scope] = provider.getPreferences();
      const languagePreferences = provider.getLanguagePreferences();
      if (languagePreferences) {
        Object.keys(languagePreferences).forEach((language) => {
          result[scope][`[${language}]`] = languagePreferences[language];
        });
      }
    }
    return result;
  }, {} as PreferenceData);
}

@Injectable({ multiple: true })
export class MainThreadPreference implements IMainThreadPreference {

  @Autowired(PreferenceService)
  protected preferenceService: PreferenceService;

  @Autowired(PreferenceProviderProvider)
  protected preferenceProviderProvider: PreferenceProviderProvider;

  @Autowired(PreferenceSchemaProvider)
  protected preferenceSchemaProvider: PreferenceSchemaProvider;

  @Autowired(IWorkspaceService)
  protected workspaceService: IWorkspaceService;

  protected readonly toDispose = new DisposableCollection();

  private readonly proxy: any;
  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostPreference);
    this.toDispose.push(this.preferenceService.onPreferencesChanged((changes) => {
      const roots = this.workspaceService.tryGetRoots();
      const data = getPreferences(this.preferenceProviderProvider, roots);
      const eventData: PreferenceChangeExt[] = [];
      for (const preferenceName of Object.keys(changes)) {
        const { newValue } = changes[preferenceName];
        eventData.push({ preferenceName, newValue });
      }
      this.proxy.$acceptConfigurationChanged(data, eventData);
    }));

    this.initializeConfiguration();

    this.toDispose.push(this.preferenceSchemaProvider.onDidPreferenceSchemaChanged(() => {
      this.initializeConfiguration();
    }));
  }

  dispose() {
    this.toDispose.dispose();
  }

  async initializeConfiguration() {
    const roots = this.workspaceService.tryGetRoots();
    const data = getPreferences(this.preferenceProviderProvider, roots);
    this.proxy.$initializeConfiguration(data);
  }

  async $updateConfigurationOption(
    target: boolean | ConfigurationTarget | undefined,
    key: string,
    value: any,
    resource?: string,
  ) {
    const scope = this.parseConfigurationTarget(target);
    await this.preferenceService.set(key, value, scope, resource);
  }

  async $removeConfigurationOption(
    target: boolean | ConfigurationTarget | undefined,
    key: string,
    resource?: string,
  ) {
    const scope = this.parseConfigurationTarget(target);
    await this.preferenceService.set(key, undefined, scope, resource);
  }

  /**
   * 装换VSCode ConfigurationTaregt到PreferenceService中的Scope
   * @param target
   */
  private parseConfigurationTarget(target?: boolean | ConfigurationTarget): PreferenceScope | undefined {
    if (typeof target === 'boolean') {
      return target ? PreferenceScope.User : PreferenceScope.Workspace;
    }
    switch (target) {
      case ConfigurationTarget.Global:
        return PreferenceScope.User;
      case ConfigurationTarget.Workspace:
        return PreferenceScope.Workspace;
      case ConfigurationTarget.WorkspaceFolder:
        return PreferenceScope.Folder;
      default:
        return undefined;
    }
  }

}
