import { CancellationToken } from '@ide-framework/ide-core-common';

export const FileSearchServicePath = 'FileSearchServicePath';

/**
 * The JSON-RPC file search service interface.
 */
export interface IFileSearchService {

  /**
   * finds files by a given search pattern.
   * @return the matching paths, relative to the given `options.rootUri`.
   */
  find(searchPattern: string, options: IFileSearchService.Options, cancellationToken?: CancellationToken): Promise<string[]>;

}

export const IFileSearchService = Symbol('FileSearchService');

export namespace IFileSearchService {
  export interface BaseOptions {
    useGitIgnore?: boolean;
    noIgnoreParent?: boolean; // 是否忽略祖先目录的 gitIgnore
    includePatterns?: string[];
    excludePatterns?: string[];
  }
  export interface RootOptions {
    [rootUri: string]: BaseOptions;
  }
  export interface Options extends BaseOptions {
    rootUris?: string[];
    rootOptions?: RootOptions;
    fuzzyMatch?: boolean;
    limit?: number;
    /**
     * when `undefined`, no excludes will apply, when empty array, default excludes will apply
     *
     * @deprecated since 0.5.0 use `excludePatterns` instead
     */
    defaultIgnorePatterns?: string[];
  }
}
