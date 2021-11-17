import { Autowired, Injectable } from '@ide-framework/common-di';
import { URI, PreferenceScope } from '@ide-framework/ide-core-browser';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';
import { FileStat } from '@ide-framework/ide-file-service';
import { IWorkspaceService } from '@ide-framework/ide-workspace/lib/common';

export const FolderPreferenceProviderFactory = Symbol('FolderPreferenceProviderFactory');
export type FolderPreferenceProviderFactory = (options: FolderPreferenceProviderOptions) => FolderPreferenceProvider;

export const FolderPreferenceProviderOptions = Symbol('FolderPreferenceProviderOptions');
export interface FolderPreferenceProviderOptions {
  readonly folder: FileStat;
  readonly configUri: URI;
}

/**
 * 这玩意应该叫 FolderFilePreferenceProvider， 它代表的是一个文件夹下的 “一个” 文件读出来的配置项
 * 但是一个文件夹的配置文件夹比如 .kaitian 内可以存在多个这样的文件, 比如 settings.json, launch.json
 * 他们的结果会合并并且放入各自的section中。
 */
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

  public getUri(): URI {
    return this.options.configUri;
  }

  protected getScope(): PreferenceScope {
    // 当在非工作区场景下时，采用PreferenceScope.Workspace作为配置作用域
    if (!this.workspaceService.isMultiRootWorkspaceOpened) {
      return PreferenceScope.Workspace;
    }
    return PreferenceScope.Folder;
  }

  getDomain(): string[] {
    return [this.folderUri.toString()];
  }

}
