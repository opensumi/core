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
  test('method:replaceAll 无 dialogService、messageService', async () => {
    const resultMap: Map<string, ContentSearchResult[]> = new Map();
    const workspaceEditorService: any = new MockWorkspaceEditorService();

    resultMap.set(searchResult.fileUri, [searchResult]);

    const result = await replaceAll(workspaceEditorService, resultMap, 'replace');

    expect(result).toEqual(true);
  });
});
