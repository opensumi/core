import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { preferenceScopeProviderTokenMap, PreferenceScope, PreferenceProvider } from '@ali/ide-core-browser';

@Injectable()
export class PreferenceService {

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.Folder])
  private folderFilePreference: PreferenceProvider;

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.User])
  userFilePreference: PreferenceProvider;

  @Autowired(FileServiceClient)
  private fileServiceClient: FileServiceClient;

  @observable
  public preferenceList = async () => {
    /*
    const uri = this.userFilePreference.getConfigUri();
    const filePath = uri && uri.toString();

    if (filePath && await this.fileServiceClient.exists(filePath)) {
      const fileContent = await this.fileServiceClient.resolveContent(filePath);
    } else {

    }
    */

    return this.userFilePreference.getPreferences();
  }

  public async setPreference(key: string, value: string){
    return await this.userFilePreference.setPreference(key, value);

  }

}
