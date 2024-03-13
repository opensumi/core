import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceScope, URI } from '@opensumi/ide-core-browser';
import { FileStat } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';

export const FolderFilePreferenceProviderFactory = Symbol('FolderFilePreferenceProviderFactory');
export type FolderFilePreferenceProviderFactory = (
  options: FolderFilePreferenceProviderOptions,
) => FolderFilePreferenceProvider;

export const FolderFilePreferenceProviderOptions = Symbol('FolderFilePreferenceProviderOptions');
export interface FolderFilePreferenceProviderOptions {
  readonly folder: FileStat;
  readonly configUri: URI;
}

/**
 * 配置文件夹比如 `.sumi` 内可以存在多个这样的文件, 比如: settings.json, launch.json, tasks.json 等
 */
@Injectable()
export class FolderFilePreferenceProvider extends AbstractResourcePreferenceProvider {
  // 与 `launch.json` 等其他配置文件不同，options 会有所差异
  @Autowired(FolderFilePreferenceProviderOptions)
  protected readonly options: FolderFilePreferenceProviderOptions;

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
