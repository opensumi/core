import { Tiktoken } from 'tiktoken/lite';

import { Injector } from '@opensumi/di';

import { LanguageParser } from '../../../languages/parser';
import { LanguageParserService } from '../../../languages/service';
import { StrategyType, WishListAttributeName } from '../types';

import { LANGUAGE_COMMENT_MARKERS } from './const';
import { getTokenizer } from './tokenizer';

import type { ICompletionContext, ICompletionModel, MarkerItem } from '../types';
import type * as monaco from '@opensumi/ide-monaco';

export const addComment = (commentText?: string) => {
  if (commentText) {
    return `${commentText}\n`;
  }
  return '';
};

export const getMarkerByLanguage = (text: string, language: string) => {
  const marker = LANGUAGE_COMMENT_MARKERS[language];
  if (marker) {
    const end = marker.end === '' ? '' : ` ${marker.end}`;
    return `${marker.start} ${text}${end}`;
  }
  return '';
};

export const getLanguageMarker = (language: string) => {
  if (!language) {
    return '';
  }
  const supportLanguage: {
    [key: string]: string;
  } = {
    html: '<!DOCTYPE html>',
    python: '#!/usr/bin/env python3',
    ruby: '#!/usr/bin/env ruby',
    shellscript: '#!/bin/sh',
    yaml: '# YAML data',
  };
  let marker = '';
  if (supportLanguage[language]) {
    return supportLanguage[language];
  }
  marker = `Language: ${language}`;

  return getMarkerByLanguage(marker, language);
};

// 根据语言类型获取不同的注释内容
export const getPathMarker = (path: string, language: string) => path && getMarkerByLanguage(`Path: ${path}`, language);

export const getMarkerForSnippets = (text: string, language: string) => {
  const lines = text.split('\n');
  return lines.map((line) => getMarkerByLanguage(line, language)).join('\n');
};

export const getCroppedTextByLine = (
  text: string,
  maxTokenSize: number,
  textTokens: Uint32Array[],
  reverse = false,
) => {
  const currentTokenSize = textTokens.reduce((prev, cur) => prev + cur.length, 0);
  if (currentTokenSize < maxTokenSize) {
    return text;
  }
  const lines = text.split('\n');
  const endLine = lines.length;
  let currenSize = 0;
  if (reverse) {
    let index = 0;
    for (; index < endLine; index++) {
      const tokens = textTokens[index];
      currenSize += tokens.length;
      if (currenSize < maxTokenSize) {
        continue;
      } else {
        break;
      }
    }
    if (index === endLine) {
      return text;
    }
    return lines.slice(0, index).join('\n');
  }
  let index = endLine - 1;
  for (; index >= 0; index--) {
    const tokens = textTokens[index];
    currenSize += tokens.length;
    if (currenSize < maxTokenSize) {
      continue;
    } else {
      break;
    }
  }
  if (index === -1) {
    return text;
  }
  return lines.slice(index).join('\n');
};

/**
 * 裁剪字符函数
 * @param text 文本内容
 * @param maxTokenSize 最大 token 数量
 * @param strategy 分割策略
 * @param language 语言类型，按函数分割仅在 typescript/javascript/typescriptreact 中支持
 * @param reverse 是否反向裁剪，即从后往前裁剪
 */
export const getCroppedText = async (
  text: string,
  maxTokenSize: number,
  textTokens: Uint32Array[],
  strategy = StrategyType.InterceptBasedOnLine,
  tokenizer: Tiktoken,
  parser?: LanguageParser,
  minBlockSize = 20,
  reverse = false,
  token?: monaco.CancellationToken,
): Promise<string> => {
  let tokens: Uint32Array;
  if (strategy === StrategyType.InterceptBasedOnLine) {
    // 按行进行裁剪
    text = getCroppedTextByLine(text, maxTokenSize, textTokens, reverse);
  } else if (strategy === StrategyType.InterceptBasedOnFunction && !reverse) {
    tokens = tokenizer.encode(text);
    // 按函数进行裁剪
    while (tokens.length > maxTokenSize) {
      if (reverse) {
        try {
          text = text.slice(0, Math.ceil((maxTokenSize / tokens.length) * tokens.length));
          text = (await parser?.trimSuffixSyntaxErrors(text, minBlockSize)) || text;
        } catch {
          text = getCroppedTextByLine(text, maxTokenSize, textTokens, reverse);
        }
      } else {
        try {
          text = text.slice(-Math.ceil((maxTokenSize / tokens.length) * tokens.length));
          text = (await parser?.trimPrefixSyntaxErrors(text, minBlockSize)) || text;
          if (token?.isCancellationRequested) {
            return '';
          }
        } catch {
          text = getCroppedTextByLine(text, maxTokenSize, textTokens, reverse);
        }
      }
      tokens = tokenizer.encode(text);
    }
  } else {
    tokens = tokenizer.encode(text);
    // 按字符进行裁剪
    while (tokens.length > maxTokenSize) {
      const splitWords = text.split('');
      if (reverse) {
        text = splitWords.slice(0, -(tokens.length - maxTokenSize)).join('');
      } else {
        text = splitWords.slice(tokens.length - maxTokenSize).join('');
      }
      tokens = tokenizer.encode(text);
    }
  }
  return text;
};

export const getBeforePrompt = async (
  promptPriority: MarkerItem[],
  context: ICompletionContext,
  promptConfig: ICompletionModel,
  leftTokenSize: number,
  injector: Injector,
  token: monaco.CancellationToken,
) => {
  const { tokenizerName, wishList } = promptConfig;
  const tokenizer = getTokenizer(tokenizerName);

  // 根据优先级降序排序
  const sortedPromptPriority = promptPriority.sort((a, b) => b.priority - a.priority);
  const promptList: {
    [key in WishListAttributeName]?: string;
  } = {};
  for (const current of sortedPromptPriority) {
    if (!leftTokenSize) {
      return;
    }
    if (current.content) {
      const tokens = current.content.split('\n').map((line) => tokenizer.encode(line));
      const currentTokenSize = tokens.reduce((prev, cur) => prev + cur.length, 0);
      const maxTokenSize = Math.ceil(current.maxPercent * leftTokenSize);
      if (currentTokenSize > leftTokenSize) {
        const languageParserService = injector.get(LanguageParserService) as LanguageParserService;
        const languageParser = languageParserService.createParser(context.language);
        promptList[current.attributeName] = await getCroppedText(
          current.content,
          maxTokenSize,
          tokens,
          promptConfig.wishList.beforeCursor.strategy,
          tokenizer,
          languageParser,
          wishList.beforeCursor.extOption.minBlockSize ?? 75,
          false,
          token,
        );
        if (token.isCancellationRequested) {
          return;
        }
        leftTokenSize -= maxTokenSize;
      } else {
        leftTokenSize -= currentTokenSize;
        promptList[current.attributeName] = `${current.content}`;
      }
    } else if (current.importedFiles && current.importedFiles.length > 0) {
      let currentImportedFile = '';
      const maxImportedFileTokenSize = Math.ceil(current.maxPercent * leftTokenSize);
      let currentImportedFileTokenSize = 0;
      for (const [filename, importedFile] of current.importedFiles) {
        const importedFileMarker = getMarkerByLanguage(
          `${promptConfig.wishList.importedFile.extOption.patternPrefix}${filename}:${
            promptConfig.wishList.importedFile.extOption.patternSuffix || '\n'
          }${getMarkerForSnippets((importedFile as string[]).join('\n'), context.language)}\n`,
          context.language,
        );
        const tokens = tokenizer.encode(importedFileMarker);
        if (tokens.length > leftTokenSize || currentImportedFileTokenSize + tokens.length > maxImportedFileTokenSize) {
          break;
        }
        leftTokenSize -= tokens.length;
        currentImportedFileTokenSize += tokens.length;
        currentImportedFile += importedFileMarker;
      }
      if (currentImportedFile) {
        // 移除末尾多余的 \n
        currentImportedFile = currentImportedFile.slice(0, -'\n'.length);
        promptList[current.attributeName] = `${currentImportedFile}`;
      }
    } else if (current.similarSnippets && current.similarSnippets.length > 0) {
      let currentSnippet = '';
      const maxSnippetSize = Math.ceil(current.maxPercent * leftTokenSize);
      let currentSnippetSize = 0;
      for (const [filename, snippets] of current.similarSnippets) {
        const similarSnippetMarker = snippets
          .map((snippet) =>
            getMarkerByLanguage(
              `${promptConfig.wishList.similarFile.extOption.patternPrefix}${filename}:${
                promptConfig.wishList.similarFile.extOption.patternSuffix || '\n'
              }${getMarkerForSnippets(snippet.snippet, context.language)}`,
              context.language,
            ),
          )
          .join('\n');
        const tokens = tokenizer.encode(similarSnippetMarker);
        if (tokens.length > leftTokenSize || currentSnippetSize + tokens.length > maxSnippetSize) {
          break;
        }
        leftTokenSize -= tokens.length;
        currentSnippetSize += tokens.length;
        currentSnippet += similarSnippetMarker;
      }
      if (currentSnippet) {
        promptList[current.attributeName] = `${currentSnippet}`;
      }
    }
  }
  return `${addComment(promptList.languageMarker)}${addComment(promptList.pathMarker)}${addComment(
    promptList.importedFile,
  )}${addComment(promptList.similarFile)}${addComment(promptList.beforeCursor)}`.slice(0, -'\n'.length);
};

export const getAfterPrompt = async (
  context: ICompletionContext,
  promptConfig: ICompletionModel,
  injector: Injector,
  token: monaco.CancellationToken,
) => {
  const { maxPromptTokenSize, tokenizerName, wishList } = promptConfig;
  const tokenizer = getTokenizer(tokenizerName);
  let afterCursor = context.suffix;
  const afterCursorOptions = promptConfig.wishList.afterCursor.extOption;
  const afterCursorTokens = afterCursor.split('\n').map((line) => tokenizer.encode(line));
  const currentAfterCursorTokenSize = afterCursorTokens.reduce((prev, cur) => prev + cur.length, 0);
  const afterCursorMaxTokenSize = Math.ceil(afterCursorOptions.suffixPercent * maxPromptTokenSize);
  if (currentAfterCursorTokenSize > afterCursorMaxTokenSize) {
    const languageParserService = injector.get(LanguageParserService) as LanguageParserService;
    const languageParser = languageParserService.createParser(context.language);
    afterCursor = await getCroppedText(
      afterCursor,
      afterCursorMaxTokenSize,
      afterCursorTokens,
      promptConfig.wishList.afterCursor.strategy,
      tokenizer,
      languageParser,
      wishList.afterCursor.extOption.minBlockSize ?? 25,
      true,
      token,
    );
  }
  return afterCursor;
};
