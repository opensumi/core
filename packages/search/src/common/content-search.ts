import { endsWith, startsWith } from '@ali/ide-core-common';
import { TreeNode, TreeNodeHighlightRange } from '@ali/ide-core-browser/lib/components';

export const ContentSearchServerPath = 'ContentSearchServerPath';

export const IContentSearchServer = Symbol('ContentSearchService');

export const DEFAULT_SEARCH_IN_WORKSPACE_LIMIT = 2000;

export interface ContentSearchOptions {
  /**
   * Maximum number of results to return.  Defaults to DEFAULT_SEARCH_IN_WORKSPACE_LIMIT.
   */
  maxResults?: number;
  /**
   * Search case sensitively if true.
   */
  matchCase?: boolean;
  /**
   * Search whole words only if true.
   */
  matchWholeWord?: boolean;
  /**
   * Use regular expressions for search if true.
   */
  useRegExp?: boolean;
  /**
   * Include all .gitignored and hidden files.
   */
  includeIgnored?: boolean;
  /**
   * Glob pattern for matching files and directories to include the search.
   */
  include?: string[];
  /**
   * Glob pattern for matching files and directories to exclude the search.
   */
  exclude?: string[];
}

export interface IContentSearchServer {
  /**
   * Start a search for WHAT in directories ROOTURIS.  Return a unique search id.
   */
  search(what: string, rootUris: string[], opts?: ContentSearchOptions): Promise<number>;

  /**
   * Cancel an ongoing search.
   */
  cancel(searchId: number): Promise<void>;

  // dispose(): void;
}

export interface IContentSearchClientService {
  replaceValue: string;
  searchValue: string;
  searchError: string;
  searchState: SEARCH_STATE;
  UIState: IUIState;
  searchResults: Map<string, ContentSearchResult[]>;
  resultTotal: ResultTotal;
  docModelSearchedList: string[];
  currentSearchId: number;
  searchInputEl: React.MutableRefObject<HTMLInputElement | null>;
  replaceInputEl: React.MutableRefObject<HTMLInputElement | null>;
  includeInputEl: React.MutableRefObject<HTMLInputElement | null>;
  excludeInputEl: React.MutableRefObject<HTMLInputElement | null>;
}

export interface IUIState {
  isSearchFocus: boolean;
  isToggleOpen: boolean;
  isDetailOpen: boolean;
  isMatchCase: boolean;
  isWholeWord: boolean;
  isUseRegexp: boolean;

  isIncludeIgnored: boolean;
  isReplaceDoing: boolean;
}

export interface ContentSearchResult {
  /**
   * The string uri to the root folder that the search was performed.
   */
  root: string;

  /**
   * The string uri to the file containing the result.
   */
  fileUri: string;

  /**
   * The (1-based) line number of the result.
   */
  line: number;

  /**
   * The (1-based) character number in the result line.  For UTF-8 files,
   * one multi-byte character counts as one character.
   */
  matchStart: number;

  /**
   * The length of the match, in characters.  For UTF-8 files, one
   * multi-byte character counts as one character.
   */
  matchLength: number;

  /**
   * The text of the line containing the result.
   */
  lineText: string;
}

export enum SEARCH_STATE {
  todo,
  doing,
  done,
  error,
}

export interface SendClientResult {
  data: ContentSearchResult[];
  id: number;
  searchState?: SEARCH_STATE;
  error?: string;
  docModelSearchedList?: string[];
}

export interface ResultTotal {
  fileNum: number;
  resultNum: number;
}

/**
 * 辅助搜索，补全通配符
 */
export function anchorGlob(glob: string): string {
  const pre = '**/';

  if (startsWith(glob, './')) {
    // 相对路径转换
    glob = glob.replace(/^.\//, '');
  }
  if (endsWith(glob, '/')) {
    // 普通目录
    return `${pre}${glob}**`;
  }
  if (!/[\*\{\(\+\@\!\^\|\?]/.test(glob) && !/\.[A-Za-z0-9]+$/.test(glob)) {
    // 不包含 Glob 特殊字符的普通目录
    return `${pre}${glob}/**`;
  }
  return `${pre}${glob}`;
}

export function getRoot(rootUris ?: string[], uri ?: string): string {
  let result: string = '';
  if (!rootUris || !uri) {
    return result;
  }
  rootUris.some((root) => {
    if (uri.indexOf(root) === 0) {
      result = root;
      return true;
    }
  });

  return result;
}

export const SEARCH_CONTAINER_ID = 'search';

export namespace SearchBindingContextIds {
  export const searchInputFocus = 'searchInputFocus';
}

export const SEARCH_CONTEXT_MENU = 'search-context-menu-path';

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  children?: ISearchTreeItem[];
  badge?: number;
  highLightRange?: TreeNodeHighlightRange;
  searchResult?: ContentSearchResult;
  [key: string]: any;
}
