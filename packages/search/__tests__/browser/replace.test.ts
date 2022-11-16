import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';

import { replaceAll } from '../../src/browser/replace';
import { ContentSearchResult } from '../../src/common';

(global as any).monaco = {
  Selection: class Selection {},
  Range: class Range {},
};

class MockWorkspaceEditorService {
  apply() {}
}

const searchResult: ContentSearchResult = {
  fileUri: 'carrots',
  line: 1,
  matchStart: 11,
  matchLength: 12,
  renderLineText: '',
  renderStart: 2,
};

describe('测试 replace', () => {
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    });
  });

  test('method:replaceAll 无 dialogService、messageService', async () => {
    const resultMap: Map<string, ContentSearchResult[]> = new Map();
    const workspaceEditorService: any = new MockWorkspaceEditorService();
    const documentModelService = injector.get(IEditorDocumentModelService);

    resultMap.set(searchResult.fileUri, [searchResult]);

    const result = await replaceAll(documentModelService, workspaceEditorService, resultMap, 'replace');

    expect(result).toEqual(true);
  });
});
