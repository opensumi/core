import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { preferenceScopeProviderTokenMap, PreferenceScope, PreferenceProvider, PreferenceSchemaProvider } from '@ali/ide-core-browser';

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

  constructor() {
  }

  @observable
  public getPreferences = async (selectedPreference: PreferenceProvider) => {
    return selectedPreference.getPreferences();
  }

  public async setPreference(key: string, value: string, selectedPreference: PreferenceProvider) {
    return await selectedPreference.setPreference(key, value);

  }

}
