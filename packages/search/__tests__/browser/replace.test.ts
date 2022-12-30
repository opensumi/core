import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/main';
import { IResourceTextEdit, IWorkspaceEdit } from '@opensumi/ide-workspace-edit';

import { replaceAll } from '../../src/browser/replace';
import { ContentSearchResult } from '../../src/common';

(global as any).monaco = {
  Selection: class Selection {},
  Range: class Range {},
};

class MockWorkspaceEditorService {
  private _edit: IWorkspaceEdit;
  apply(edit: IWorkspaceEdit) {
    this._edit = edit;
  }

  get edit() {
    return this._edit;
  }
}

const searchResult: ContentSearchResult = {
  fileUri: new URI('home/test.js').toString(),
  line: 1,
  matchStart: 1,
  matchLength: 28,
  renderLineText: "const test = require('test')",
  renderStart: 1,
};

describe('replace', () => {
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    });
  });

  test('replaceAll without dialogService and messageService', async () => {
    const resultMap: Map<string, ContentSearchResult[]> = new Map();
    const workspaceEditorService: any = new MockWorkspaceEditorService();
    const documentModelService = injector.get(IEditorDocumentModelService);

    resultMap.set(searchResult.fileUri, [searchResult]);

    const result = await replaceAll(documentModelService, workspaceEditorService, resultMap, 'replace', 'search');

    expect(result).toEqual(true);
  });

  test('replaceAll by RegExp', async () => {
    const resultMap: Map<string, ContentSearchResult[]> = new Map();
    const workspaceEditorService = new MockWorkspaceEditorService();
    const documentModelService = injector.get(IEditorDocumentModelService);

    resultMap.set(searchResult.fileUri, [searchResult]);

    const searchText = 'const (.+) = require((.*))';
    const replaceText = '$1...$2';
    const result = await replaceAll(
      documentModelService,
      workspaceEditorService as any,
      resultMap,
      replaceText,
      searchText,
      true,
    );
    expect(result).toBeTruthy();
    const edit = workspaceEditorService.edit;
    expect(edit).toBeDefined();
    expect(edit.edits.length).toBe(1);
    expect((edit.edits[0] as IResourceTextEdit).textEdit.text).toBe("test...('test')");
  });
});
