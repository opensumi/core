import {
  ICompletionModel,
  NeighboringTabsOption,
  SnippetSelectionOption,
  StrategyType,
  TokenizerName,
  WishListAttributeName,
} from './types';

export const DEFAULT_COMPLECTION_MODEL: ICompletionModel = {
  maxPromptTokenSize: 3000,
  maxExecuteTimeMillSecond: 1000,
  tokenizerName: TokenizerName.cl100k_base,
  wishList: {
    afterCursor: {
      enable: true,
      attributeName: WishListAttributeName.afterCursor,
      extOption: {
        suffixPercent: 0.25,
        minBlockSize: 25,
      },
      priority: 1,
      strategy: StrategyType.InterceptBasedOnLine,
    },
    beforeCursor: {
      enable: true,
      attributeName: WishListAttributeName.beforeCursor,
      extOption: {
        prefixPercent: 0.75,
        minBlockSize: 75,
      },
      priority: 0,
      strategy: StrategyType.InterceptBasedOnLine,
    },
    importedFile: {
      attributeName: WishListAttributeName.importedFile,
      enable: true,
      extOption: {
        maxTime: 200,
        importedFilesMaxNum: 10,
        language: ['typescript'],
        maxPercent: 0.8,
        patternPrefix: 'Import Files from ',
        patternSuffix: '\n',
      },
      priority: 3,
      strategy: StrategyType.InterceptBasedOnLine,
    },
    languageMarker: {
      attributeName: WishListAttributeName.languageMarker,
      enable: true,
      extOption: {
        language: ['python', 'html'],
        maxPercent: 0,
      },
      priority: 4,
      strategy: StrategyType.InterceptBasedOnLine,
    },
    pathMarker: {
      attributeName: WishListAttributeName.pathMarker,
      enable: true,
      priority: 1,
      strategy: StrategyType.InterceptBasedOnLine,
    },
    similarFile: {
      attributeName: WishListAttributeName.similarFile,
      enable: true,
      extOption: {
        maxTime: 200,
        fileMaxLength: 5000,
        maxPercent: 0.3,
        neighboringTabsMaxNum: 20,
        neighboringTabsOption: [
          NeighboringTabsOption.openFileHistory,
          NeighboringTabsOption.editFileRecent,
          NeighboringTabsOption.editFileHistory,
        ],
        patternPrefix: 'Compare this snippet from ',
        patternSuffix: '\n',
        similarityThreshold: 0.6,
        snippetMaxNum: 4,
        windowSize: 60,
        snippetSelectionMode: SnippetSelectionOption.BestMatch,
      },
      priority: 2,
      strategy: StrategyType.InterceptBasedOnLine,
    },
  },
};

export const lineBasedCompletionModelConfigs = {
  completionPromptMaxLineSize: 1024,
  completionSuffixMaxLineSize: 500,
};
