import { Injector } from '@opensumi/di';

import { lineBasedCompletionModelConfigs } from './constants';
import { getImportedFile } from './prompt/importedFiles';
import { getAfterPrompt, getBeforePrompt, getLanguageMarker, getPathMarker } from './prompt/prompt';
import { getSimilarSnippets } from './prompt/similarSnippets';
import { ICompletionContext, ICompletionModel, MarkerItem, MatchSimilarSnippet } from './types';

import type * as monaco from '@opensumi/ide-monaco';

export async function getPrefixPrompt(
  context: ICompletionContext,
  promptConfig: ICompletionModel,
  injector: Injector,
  token: monaco.CancellationToken,
): Promise<string> {
  const beforeCursor = context.prefix;
  const smiilarSnippetPriority = promptConfig.wishList.similarFile.priority;
  const beforeCursorPriority = promptConfig.wishList.beforeCursor.priority;
  const importedFilePriority = promptConfig.wishList.importedFile.priority;
  const pathMarkderPriority = promptConfig.wishList.pathMarker.priority;
  const languageMarkerPriority = promptConfig.wishList.languageMarker.priority;

  const { maxPromptTokenSize } = promptConfig;

  const prefixPercent = 1 - (promptConfig.wishList.afterCursor.extOption.suffixPercent ?? 0.25);
  const beforeCursorMaxTokenSize = Math.ceil(prefixPercent * maxPromptTokenSize);
  const leftTokenSize = beforeCursorMaxTokenSize;

  // Language Marker
  const languageMarker = promptConfig.wishList.languageMarker.enable ? getLanguageMarker(context.language) : '';
  // Path Marker
  const pathMarker = promptConfig.wishList.pathMarker.enable ? getPathMarker(context.filename, context.language) : '';
  // Similar Snippet
  const similarFileOptions = {
    ...promptConfig.wishList.similarFile.extOption,
    maxTime: Math.min(
      promptConfig.wishList.similarFile.extOption.maxTime || 200,
      promptConfig.maxExecuteTimeMillSecond,
    ),
  };
  const now = Date.now();
  const similarFileSnippets = promptConfig.wishList.similarFile.enable
    ? await getSimilarSnippets(context, similarFileOptions, injector)
    : [];
  if (token?.isCancellationRequested) {
    return beforeCursor;
  }
  const costTime = Date.now() - now;
  // Imported File
  const importedFileOptions = {
    ...promptConfig.wishList.importedFile.extOption,
    maxTime: Math.min(
      promptConfig.wishList.importedFile.extOption.maxTime,
      promptConfig.maxExecuteTimeMillSecond - costTime,
    ),
  };
  const importedFiles: (string | string[])[][] = promptConfig.wishList.importedFile.enable
    ? await getImportedFile(context, importedFileOptions, injector)
    : [];
  if (token?.isCancellationRequested) {
    return beforeCursor;
  }

  // 根据内容优先级拼接 prompt
  const promptPriority: MarkerItem[] = [
    {
      attributeName: promptConfig.wishList.languageMarker.attributeName,
      priority: languageMarkerPriority,
      maxPercent: promptConfig.wishList.languageMarker.extOption.maxPercent ?? 1,
      enable: promptConfig.wishList.languageMarker.enable ?? false,
      content: languageMarker,
    },
    {
      attributeName: promptConfig.wishList.pathMarker.attributeName,
      priority: pathMarkderPriority,
      maxPercent: promptConfig.wishList.pathMarker.extOption?.maxPercent ?? 1,
      enable: promptConfig.wishList.pathMarker.enable ?? false,
      content: pathMarker,
    },
    {
      attributeName: promptConfig.wishList.importedFile.attributeName,
      priority: importedFilePriority,
      enable: promptConfig.wishList.importedFile.enable ?? false,
      maxPercent: promptConfig.wishList.importedFile.extOption.maxPercent ?? 1,
      importedFiles,
    },
    {
      attributeName: promptConfig.wishList.similarFile.attributeName,
      priority: smiilarSnippetPriority,
      enable: promptConfig.wishList.similarFile.enable ?? false,
      similarSnippets: similarFileSnippets as [string, MatchSimilarSnippet[]][],
      maxPercent: promptConfig.wishList.similarFile.extOption.maxPercent ?? 1,
    },
    {
      attributeName: promptConfig.wishList.beforeCursor.attributeName,
      priority: beforeCursorPriority,
      maxPercent: promptConfig.wishList.beforeCursor.extOption.maxPercent ?? 1,
      enable: promptConfig.wishList.beforeCursor.enable ?? true,
      content: beforeCursor,
    },
  ];
  return (await getBeforePrompt(promptPriority, context, promptConfig, leftTokenSize, injector, token)) || beforeCursor;
}

export async function getSuffixPrompt(
  context: ICompletionContext,
  promptConfig: ICompletionModel,
  injector: Injector,
  token: monaco.CancellationToken,
): Promise<string> {
  return (await getAfterPrompt(context, promptConfig, injector, token)) || '';
}

function processPrefix(prompt: string): string {
  // remove all empty lines
  prompt = prompt.replace(/^s*[\n]/gm, '');
  const arr = prompt.split('\n');
  // if the number of lines is greater than n, take the last n lines
  if (arr.length > lineBasedCompletionModelConfigs.completionPromptMaxLineSize) {
    prompt = arr.slice(-lineBasedCompletionModelConfigs.completionPromptMaxLineSize).join('\n');
  }
  return prompt;
}

function processSuffix(suffix: string): string {
  suffix = suffix.replace(/^s*[\n]/gm, '');
  const arr = suffix.split('\n');
  if (arr.length > lineBasedCompletionModelConfigs.completionSuffixMaxLineSize) {
    suffix = arr.slice(-lineBasedCompletionModelConfigs.completionSuffixMaxLineSize).join('\n');
  }
  return suffix;
}

export const lineBasedPromptProcessor = {
  processPrefix,
  processSuffix,
};
