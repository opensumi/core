import { Injector } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { Path } from '@opensumi/ide-utils/lib/path';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { LanguageParserService } from '../../../languages/service';
import { ICompletionContext, ImportedFileOptions, ResourceDocument } from '../types';

import { LANGUAGE_TO_SUFFIX } from './languages';

export const getImportedFilesInterface = async (
  code: string,
  resource: ResourceDocument,
  options: ImportedFileOptions,
  injector: Injector,
): Promise<(string | string[])[][]> => {
  const languageParserService = injector.get(LanguageParserService) as LanguageParserService;
  let matches: string[] = [];
  const snippets: (string | string[])[][] = [];
  const languageParser = languageParserService.createParser(resource.languageId);
  if (languageParser) {
    matches = await languageParser.extractImportPaths(code);
  }
  const maxPromptTime = options.maxTime ?? 200;
  const startTime = Date.now();
  for (const file of matches) {
    let filePath = '';
    const basePath = resource.uri.parent.codeUri.fsPath;
    if (file.startsWith('@/') || file.startsWith('~') || !file.startsWith('.')) {
      // skip alias
      continue;
    }
    if (file === '.') {
      filePath = new Path(basePath).join('index.ts').toString();
    } else {
      filePath = new Path(basePath).join(`${file}${LANGUAGE_TO_SUFFIX[resource.languageId]}`).toString();
    }
    try {
      const fileService = injector.get(IFileServiceClient) as IFileServiceClient;
      const workspaceService = injector.get(IWorkspaceService) as IWorkspaceService;
      const fileUri = URI.file(filePath);
      const content = await fileService.readFile(fileUri.codeUri.fsPath);
      const interfaceCode = await languageParser?.extractInterfaceOrTypeCode(content.content.toString());
      if (interfaceCode && interfaceCode.length > 0) {
        const relative = await workspaceService.asRelativePath(fileUri);
        if (relative?.path) {
          snippets.push([relative.path, interfaceCode]);
        }
      }
    } catch {}
    if (Date.now() - startTime > maxPromptTime) {
      break;
    }
  }
  return snippets;
};

export const extractLocalImportContext = async (
  resource: ResourceDocument,
  options: ImportedFileOptions,
  injector: Injector,
): Promise<(string | string[])[][]> => {
  // 从代码中提取出所有的 import 语句，并进一步提取 interface 相关代码声明
  const { source } = resource;

  if (resource.languageId === 'typescript') {
    return getImportedFilesInterface(source, resource, options, injector);
  }
  return [];
};

export const getImportedFile = async (
  context: ICompletionContext,
  options: ImportedFileOptions,
  injector: Injector,
): Promise<(string | string[])[][]> => {
  if (context.language && !options.language.includes(context.language)) {
    return [];
  }
  const content = context.prefix;
  return extractLocalImportContext(
    {
      source: content,
      uri: context.uri,
      languageId: context.language,
      offset: content.length,
    },
    options,
    injector,
  );
};
