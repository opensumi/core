import { URI } from '@opensumi/ide-core-common';

export enum TokenizerName {
  cl100k_base = 'cl100k_base',
  gpt2 = 'gpt2',
  r50k_base = 'r50k_base',
  p50k_base = 'p50k_base',
  p50k_edit = 'p50k_edit',
  o200k_base = 'o200k_base',
}

export enum StrategyType {
  InterceptBasedOnChar = 'InterceptBasedOnChar',
  InterceptBasedOnLine = 'InterceptBasedOnLine',
  InterceptBasedOnFunction = 'InterceptBasedOnFunction',
}

export enum SnippetSelectionOption {
  BestMatch = 'bestMatch',
  TopK = 'topK',
}

export enum NeighboringTabsOption {
  openFileHistory = 'openFileHistory',
  editFileRecent = 'editFileRecent',
  editFileHistory = 'editFileHistory',
}

export enum WishListAttributeName {
  beforeCursor = 'beforeCursor',
  afterCursor = 'afterCursor',
  importedFile = 'importedFile',
  languageMarker = 'languageMarker',
  pathMarker = 'pathMarker',
  similarFile = 'similarFile',
}

// Sort Option
export enum SortOption {
  Ascending = 'ascending',
  Descending = 'descending',
  None = 'none',
}

export interface BaseWishListType {
  attributeName: WishListAttributeName;
  enable?: boolean; // 默认为 true
  ignoreDisabledStateHigherThanVersion?: string;
  extOption?: { [key: string]: any };
  priority: number;
  strategy: StrategyType;
}

export interface ImportedFileOptions {
  maxTime: number;
  importedFilesMaxNum: number;
  language: string[];
  maxPercent: number;
  patternPrefix: string;
  patternSuffix: string;
}

export enum SnippetSemantics {
  Function = 'function',
  Snippet = 'snippet',
  Variable = 'variable',
  Parameter = 'parameter',
  Method = 'method',
  Class = 'class',
  Module = 'module',
  Alias = 'alias',
  Enum = 'enum member',
  Interface = 'interface',
}

export interface SimilarFileOptions {
  maxPercent: number;
  snippetSelectionMode: SnippetSelectionOption;
  neighboringTabsMaxNum: number;
  neighboringTabsOption: NeighboringTabsOption[];
  patternPrefix: string;
  patternSuffix: string;
  similarityThreshold: number;
  snippetMaxNum: number;
  windowSize: number;
  maxTime?: number;
}

/**
 * 补全配置项
 * promptTokenSize = beforeCursorTokenSize + afterCursorTokenSize + importedFileTokenSize + pathMarkerTokenSize + languageMarkerTokenSize + similarFileTokenSize
 * maxPromptTokenSize >= promptTokenSize
 */
export interface ICompletionModel {
  maxPromptTokenSize: number;
  tokenizerName: TokenizerName;
  maxExecuteTimeMillSecond: number;
  wishList: {
    afterCursor: BaseWishListType & {
      extOption: {
        suffixPercent: number; // 0.25
        minBlockSize: number; // 20
      };
    };
    beforeCursor: BaseWishListType & {
      extOption: {
        prefixPercent: number; // 0.75,
        minBlockSize: number; // 20,
      };
    };
    importedFile: BaseWishListType & {
      extOption: ImportedFileOptions;
    };
    languageMarker: BaseWishListType & {
      extOption: {
        language: string[];
        maxPercent: number;
      };
    };
    pathMarker: BaseWishListType;
    similarFile: BaseWishListType & {
      extOption: SimilarFileOptions;
    };
  };
}

export interface ICompletionContext {
  prefix: string;
  suffix: string;
  fileUrl: string;
  filename: string;
  workspaceDir: string;
  language: string;
  uri: URI;
}

export interface CursorContext {
  context: string;
  lineCount: number;
  tokenLength: number;
  tokenizerName: TokenizerName;
}

export interface SimilarSnippet {
  score: number;
  startLine: number;
  endLine: number;
}

export interface MatchSimilarSnippet extends SimilarSnippet {
  snippet: string;
  semantics: SnippetSemantics;
}

export interface ResourceDocument {
  source: string;
  uri: URI;
  languageId: string;
  offset: number;
}

export interface MarkerItem {
  attributeName: WishListAttributeName;
  priority: number;
  maxPercent: number;
  enable: boolean;
  content?: string;
  similarSnippets?: [string, MatchSimilarSnippet[]][];
  importedFiles?: (string | string[])[][];
}
