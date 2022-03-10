import { SnippetString, Position, Range } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { TextEditorData } from '@opensumi/ide-extension/lib/hosted/api/vscode/editor/editor.host';

import { mockService } from '../../../../../../../tools/dev-tool/src/mock-injector';

describe(__filename, () => {
  describe('TextEditorData', () => {
    let textData: TextEditorData;
    const snippet = ['for (const ${2:element} of ${1:array}) {', '\t$0', '}'];
    const snippetString = new SnippetString(snippet.join('\n'));
    let $insertSnippet;
    beforeEach(() => {
      $insertSnippet = jest.fn();
      const created = mockService({
        selections: [
          {
            selectionStartLineNumber: 1,
            selectionStartColumn: 1,
            positionLineNumber: 1,
            positionColumn: 1,
          },
        ],
        visibleRanges: [],
      });
      const editorService = mockService({
        _proxy: {
          $insertSnippet,
        },
      });
      const documents = mockService({});
      textData = new TextEditorData(created, editorService, documents);
    });

    it('insert snippet when no location', () => {
      textData.insertSnippet(snippetString);
      // when location does not exist, snippet is used
      expect($insertSnippet).toBeCalledWith(
        expect.anything(),
        snippetString.value,
        [{ endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 }],
        undefined,
      );
    });

    it('insert snippet with positions', () => {
      const position1 = new Position(0, 0);
      const position2 = new Position(1, 0);
      textData.insertSnippet(snippetString, [position1, position2]);
      expect($insertSnippet).toBeCalledWith(
        expect.anything(),
        snippetString.value,
        [
          { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 },
          { endColumn: 1, endLineNumber: 2, startColumn: 1, startLineNumber: 2 },
        ],
        undefined,
      );
    });

    it('insert snippet with range', () => {
      const range = new Range(0, 0, 0, 0);
      textData.insertSnippet(snippetString, range);
      expect($insertSnippet).toBeCalledWith(
        expect.anything(),
        snippetString.value,
        [{ endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 }],
        undefined,
      );
    });

    it('insert snippet with ranges', () => {
      const range1 = new Range(0, 0, 0, 0);
      const range2 = new Range(1, 0, 1, 0);
      textData.insertSnippet(snippetString, [range1, range2]);
      expect($insertSnippet).toBeCalledWith(
        expect.anything(),
        snippetString.value,
        [
          { endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 },
          { endColumn: 1, endLineNumber: 2, startColumn: 1, startLineNumber: 2 },
        ],
        undefined,
      );
    });
  });
});
