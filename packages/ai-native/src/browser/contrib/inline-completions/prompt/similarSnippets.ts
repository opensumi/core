/* eslint-disable no-case-declarations */
import { Injector } from '@opensumi/di';
import { IEditorDocumentModel, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { isDocumentValid } from '../../../../common/utils';
import {
  ICompletionContext,
  MatchSimilarSnippet,
  NeighboringTabsOption,
  ResourceDocument,
  SimilarFileOptions,
} from '../types';

import { MAX_NEIGHBOR_AGGREGATE_LENGTH } from './const';
import { FixedWindowSizeJaccardMatcher } from './jaccardMatcher';

export const getOpenedTabFileList = (docuemnts: IEditorDocumentModel[]) => {
  // 过滤超大文档
  const recentFiles = docuemnts.filter((document) => isDocumentValid(document));
  return recentFiles;
};

export const getRecentEditFileList = () => [];

export const getNeighboringDocument = async (type: NeighboringTabsOption, injector: Injector) => {
  switch (type) {
    case NeighboringTabsOption.openFileHistory:
      const editorService = injector.get(WorkbenchEditorService) as WorkbenchEditorService;
      const documents = await editorService.getAllOpenedDocuments();
      return getOpenedTabFileList(documents);
    case NeighboringTabsOption.editFileHistory:
      // 暂不支持
      return [];
    case NeighboringTabsOption.editFileRecent:
      return [];
    default:
      return [];
  }
};

export const getNeighboringResource = async (
  targetFileName: string,
  languageId: string,
  option: SimilarFileOptions,
  injector: Injector,
) => {
  let documentList: IEditorDocumentModel[] = [];
  for (const type of option.neighboringTabsOption) {
    documentList = documentList.concat(await getNeighboringDocument(type, injector));
  }
  documentList = documentList.filter(
    (document) => document.languageId === languageId && !document.uri.displayName.endsWith(targetFileName),
  );
  // 移除重复项
  documentList = documentList.filter(
    (document, index) => documentList.findIndex((item) => item.uri === document.uri) === index,
  );

  let neighboringTabsMaxNum = 20;
  if (typeof option.neighboringTabsMaxNum === 'number') {
    neighboringTabsMaxNum = option.neighboringTabsMaxNum;
  }
  documentList = documentList.slice(0, neighboringTabsMaxNum);
  const resources: ResourceDocument[] = documentList.map((document) => {
    const content = document.getText();
    return {
      source: content,
      uri: document.uri,
      languageId: document.languageId,
      offset: content.length,
    };
  });
  return resources;
};

export const getSimilarSnippets = async (
  context: ICompletionContext,
  options: SimilarFileOptions,
  injector: Injector,
) => {
  const editorService = injector.get(WorkbenchEditorService) as WorkbenchEditorService;
  const workspaceService = injector.get(IWorkspaceService) as IWorkspaceService;
  // 过滤文件，仅保留相同后缀文件
  // 仅保留 20 项，顺序取决于配置顺序
  const neighboringFiles = await getNeighboringResource(context.filename, context.language, options, injector);
  const snippetLength = (context.prefix + context.suffix).split('\n').length;
  // 窗口大小最大不大于服务端配置的 windowSize 大小
  const windowSize = snippetLength > options.windowSize ? options.windowSize : snippetLength;

  const doMatcher = FixedWindowSizeJaccardMatcher.factory(windowSize);
  const bestMatchSnippets: [string, MatchSimilarSnippet[]][] = [];
  const currentDocument = editorService.currentEditor?.currentDocumentModel;
  if (!currentDocument) {
    return [];
  }
  const content = currentDocument.getText();
  const matcher = doMatcher.to({
    source: content,
    uri: currentDocument.uri,
    languageId: currentDocument.languageId,
    offset: content.length,
  });
  let currentLength = 0;
  const maxPromptTime = options.maxTime ?? 1000;
  const startTime = Date.now();
  for (const file of neighboringFiles) {
    currentLength += file.source.length;
    const snippet = matcher.findMatches(file, options.snippetSelectionMode);
    if (snippet && snippet.length) {
      const relative = await workspaceService.asRelativePath(file.uri);
      if (relative?.path) {
        bestMatchSnippets.push([relative.path, snippet]);
      }
    }
    if (Date.now() - startTime > maxPromptTime) {
      break;
    }
    // 计算相似性片段总长度不能超过 MAX_NEIGHBOR_AGGREGATE_LENGTH
    if (currentLength > MAX_NEIGHBOR_AGGREGATE_LENGTH) {
      break;
    }
  }
  // 对相似片段以 score 降序排序，仅取前 snippetMaxNum 项
  const sortedSnippets = bestMatchSnippets
    .filter((item) => item[1][0] && item[1][0].score > (options.similarityThreshold ?? 0.6))
    .sort((a, b) => b[1][0].score - a[1][0].score)
    .slice(0, options.snippetMaxNum || 4);
  return sortedSnippets;
};
