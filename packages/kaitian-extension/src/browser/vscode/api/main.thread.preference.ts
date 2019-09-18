import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadPreference, PreferenceData, PreferenceChangeExt } from '../../../common/vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { ConfigurationTarget } from '../../../common/vscode';
import { PreferenceService, PreferenceProviderProvider, PreferenceScope, Deferred } from '@ali/ide-core-browser';
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
      }
      return result;
  }, {} as PreferenceData);
}

@Injectable({multiple: true})
export class MainThreadPreference implements IMainThreadPreference {

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(PreferenceProviderProvider)
  preferenceProviderProvider: PreferenceProviderProvider;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  private readonly proxy: any;
  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    const roots = this.workspaceService.tryGetRoots();
    const data = getPreferences(this.preferenceProviderProvider, roots);
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostPreference);
    this.proxy.$initializeConfiguration(data);

    this.preferenceService.onPreferencesChanged((changes) => {
      const roots = this.workspaceService.tryGetRoots();
      const data = getPreferences(this.preferenceProviderProvider, roots);
      const eventData: PreferenceChangeExt[] = [];
      for (const preferenceName of Object.keys(changes)) {
          const { newValue } = changes[preferenceName];
          eventData.push({ preferenceName, newValue });
      }
      this.proxy.$acceptConfigurationChanged(data, eventData);
    });
  }

  dispose() {

  }

  async $updateConfigurationOption(
    target: boolean | ConfigurationTarget | undefined,
    key: string,
    value: any,
    resource?: string,
  ) {

  }

  async $removeConfigurationOption(
      target: boolean | ConfigurationTarget | undefined,
      key: string,
      resource?: string,
  ) {
  }

}
