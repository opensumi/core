import { replaceAll } from '../../src/browser/replace';
import {
  ContentSearchResult,
} from '../../src/common';

(global as any).monaco = {
  Selection: class Selection {},
  Range: class Range {},
};

class MockDocumentModelManager {
  createModelReferenceArgs: any[];
  pushEditOperationsArgs: any[];
  isDocModelDispose: boolean = false;
  isDocModelSaved: boolean = false;

  createModelReference(...args) {
    this.createModelReferenceArgs = args;
    return {
      instance: {
        dirty: false,

        save: () => {
          this.isDocModelSaved = true;
        },

        getMonacoModel: () => {
          return {
            pushEditOperations: (...args) => {
              this.pushEditOperationsArgs = args;
            },
            pushStackElement() {},
          };
        },
      },
      dispose: () => {
        this.isDocModelDispose = true;
      },
    };
  }
}

const searchResult: ContentSearchResult = { fileUri: 'carrots', line: 1, matchStart: 11, matchLength: 12, renderLineText: '', renderStart: 2 };

describe('测试 replace', () => {

  test('method:replaceAll 无 dialogService、messageService', async () => {
    const resultMap: Map<string, ContentSearchResult[]> = new Map();
    const documentModelManager: any = new MockDocumentModelManager();

    resultMap.set(searchResult.fileUri, [searchResult]);

    const result = await replaceAll(
      documentModelManager,
      resultMap,
      'replace',
    );

    expect(result).toEqual(true);
    expect(documentModelManager.isDocModelDispose).toEqual(true);
    expect(documentModelManager.isDocModelSaved).toEqual(true);
  });

});
