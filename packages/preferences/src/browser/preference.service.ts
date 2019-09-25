import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { preferenceScopeProviderTokenMap, PreferenceScope, PreferenceProvider, PreferenceSchemaProvider } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';

@Injectable()
export class PreferenceService {

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.Folder])
  folderPreference: PreferenceProvider;

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.User])
  userPreference: PreferenceProvider;

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.Workspace])
  workspacePreference: PreferenceProvider;

  @Autowired(PreferenceSchemaProvider)
  defaultPreference: PreferenceProvider;

  @Autowired(IWorkspaceService)
  workspaceService;

  @observable
  list: { [key: string]: any } = {};

  selectedPreference: PreferenceProvider;

  constructor() {
    this.selectedPreference = this.userPreference;
    this.workspaceService.whenReady.finally(() => {
      this.userPreference.ready.finally(() => {
        this.getPreferences(this.userPreference);
      });
    });
  }

  public getPreferences = async (selectedPreference: PreferenceProvider) => {
    this.list = await selectedPreference.getPreferences();
  }

  public async setPreference(key: string, value: string, selectedPreference: PreferenceProvider) {
    return await selectedPreference.setPreference(key, value);
  }

}
