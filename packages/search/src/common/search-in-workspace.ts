export const SearchInWorkspaceServerPath = 'SearchInWorkspaceServerPath';

export const ISearchInWorkspaceServer = Symbol('SearchInWorkspaceServer');

export const DEFAULT_SEARCH_IN_WORKSPACE_LIMIT = 2000;

export interface SearchInWorkspaceOptions {
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

export interface ISearchInWorkspaceServer {
    /**
     * Start a search for WHAT in directories ROOTURIS.  Return a unique search id.
     */
    search(what: string, rootUris: string[], opts?: SearchInWorkspaceOptions, cb?: any): Promise<number>;

    /**
     * Cancel an ongoing search.
     */
    cancel(searchId: number): Promise<void>;

    // dispose(): void;
}

export interface SearchInWorkspaceResult {
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
    character: number;

    /**
     * The length of the match, in characters.  For UTF-8 files, one
     * multi-byte character counts as one character.
     */
    length: number;

    /**
     * The text of the line containing the result.
     */
    lineText: string;
}
