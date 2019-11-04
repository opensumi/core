import { Autowired, Injectable } from '@ali/common-di';
import { URI, PreferenceScope } from '@ali/ide-core-browser';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';
import { FileStat } from '@ali/ide-file-service';
import { IWorkspaceService } from '@ali/ide-workspace/lib/common';

export const FolderPreferenceProviderFactory = Symbol('FolderPreferenceProviderFactory');
export type FolderPreferenceProviderFactory = (options: FolderPreferenceProviderOptions) => FolderPreferenceProvider;

export const FolderPreferenceProviderOptions = Symbol('FolderPreferenceProviderOptions');
export interface FolderPreferenceProviderOptions {
  readonly folder: FileStat;
  readonly configUri: URI;
}

@Injectable()
export class FolderPreferenceProvider extends AbstractResourcePreferenceProvider {

  // 与`launch.json`等其他配置文件不同，options会有所差异
  @Autowired(FolderPreferenceProviderOptions)
  protected readonly options: FolderPreferenceProviderOptions;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;
  // 缓存目录URI
  private _folderUri: URI;

  get folderUri(): URI {
    if (!this._folderUri) {
      this._folderUri = new URI(this.options.folder.uri);
    }
    return this._folderUri;
  }

  protected getUri(): URI {
    return this.options.configUri;
  }

  protected getScope(): PreferenceScope {
    // 当在混合工作区下时，采用Folder作用域配置
    if (!this.workspaceService.isMultiRootWorkspaceOpened) {
      return PreferenceScope.Workspace;

    }
    return PreferenceScope.Folder;
  }

  getDomain(): string[] {
    return [this.folderUri.toString()];
  }

}
