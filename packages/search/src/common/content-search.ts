import { TreeNode, ValidateMessage } from '@opensumi/ide-core-browser/lib/components';
import { Command } from '@opensumi/ide-core-common';
import { parseGlob, ParsedPattern, URI, strings } from '@opensumi/ide-core-common';

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
  /**
   * Interpret files using this encoding.
   * See the setting `"files.encoding"`
   */
  encoding?: string;
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

export const IContentSearchClientService = Symbol('IContentSearchClientService');

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

  isSearchDoing: boolean;

  isShowValidateMessage: boolean;

  validateMessage: ValidateMessage | undefined;

  updateUIState(obj, e?: React.KeyboardEvent);
}

export interface IUIState {
  isSearchFocus: boolean;
  isToggleOpen: boolean;
  isDetailOpen: boolean;
  isMatchCase: boolean;
  isWholeWord: boolean;
  isUseRegexp: boolean;
  isOnlyOpenEditors: boolean;

  isIncludeIgnored: boolean;
}

export interface ContentSearchResult {
  /**
   * ?????????????????????
   */
  root?: string;

  /**
   * ??????Uri
   */
  fileUri: string;

  /**
   * ????????????
   */
  line: number;

  /**
   * ????????????
   */
  matchStart: number;

  /**
   * ????????????
   */
  matchLength: number;

  /**
   * ????????????????????????????????????????????? rangeLineText ?????????
   */
  lineText?: string;

  /**
   * ????????????????????????????????????????????????
   */
  renderStart?: number;

  /**
   * ??????????????????????????????????????????
   */
  renderLineText?: string;
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
 * ??????????????????????????????
 */
export function anchorGlob(glob: string, isApplyPre?: boolean): string {
  const pre = isApplyPre === false ? '' : '**/';

  if (strings.startsWith(glob, './')) {
    // ??????????????????
    glob = glob.replace(/^.\//, '');
  }
  if (strings.endsWith(glob, '/')) {
    // ????????????
    return `${pre}${glob}**`;
  }
  if (!/[*{(+@!^|?]/.test(glob) && !/\.[A-Za-z0-9]+$/.test(glob)) {
    // ????????? Glob ???????????????????????????
    return `${pre}${glob}/**`;
  }
  if (!strings.startsWith(glob, pre)) {
    return `${pre}${glob}`;
  }
  return glob;
}

export function getRoot(rootUris?: string[], uri?: string): string {
  let result = '';
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

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  children?: ISearchTreeItem[];
  badge?: number;
  searchResult?: ContentSearchResult;
  [key: string]: any;
}

/**
 * ??????????????????????????????????????? renderLineText???renderStart
 * @param insertResult
 */

export function cutShortSearchResult(insertResult: ContentSearchResult): ContentSearchResult {
  const result = Object.assign({}, insertResult);
  const { lineText, matchLength, matchStart } = result;
  const maxLineLength = 500;
  const maxMatchLength = maxLineLength;

  if (!lineText) {
    return result;
  }

  if (lineText.length > maxLineLength) {
    // ????????????????????????????????????
    const preLength = 20;
    const start = matchStart - preLength > -1 ? matchStart - preLength : 0;
    result.renderLineText = lineText.slice(start, start + 500);
    delete result.lineText;
    result.renderStart = matchStart - start;
    result.matchLength = matchLength > maxMatchLength ? maxMatchLength : matchLength;
    return result;
  } else {
    // ?????????????????????
    const preLength = 40;
    const start = matchStart - preLength > -1 ? matchStart - preLength : 0;
    result.renderLineText = lineText.slice(start, lineText.length);
    delete result.lineText;
    result.renderStart = matchStart - start;
    return result;
  }
}

export interface OpenSearchCmdOptions {
  includeValue: string;
}

export const openSearchCmd: Command = {
  id: 'content-search.openSearch',
  category: 'search',
  label: 'Open search sidebar',
};

/**
 * ???????????? ??????????????????????????????????????????glob ?????????????????????????????????
 */
export class FilterFileWithGlobRelativePath {
  private matcherList: { relative: ParsedPattern; absolute: ParsedPattern }[] = [];

  constructor(roots: string[], globs: string[]) {
    if (roots.length < 1 || globs.length < 1) {
      return;
    }

    roots.forEach((root) => {
      const rootUri = new URI(root);

      globs.forEach((glob) => {
        if (strings.startsWith(glob, './')) {
          // ??????????????????
          const relative = parseGlob(anchorGlob(glob));
          glob = glob.slice(2, glob.length);

          const pathStrWithExclude = rootUri.resolve(anchorGlob(glob, false)).path.toString();
          this.matcherList.push({
            relative,
            absolute: parseGlob(pathStrWithExclude),
          });
        }
      });
    });
  }

  test(uriString: string) {
    let result = true;

    if (this.matcherList.length < 1) {
      return result;
    }
    const pathStr = new URI(uriString).path.toString();

    this.matcherList.some((matchers) => {
      if (!matchers.relative(pathStr)) {
        return;
      } else {
        result = false;
      }
      result = matchers.absolute(pathStr);
      return result;
    });

    return result;
  }
}
