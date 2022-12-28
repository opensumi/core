import { ComputerDiffModel } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/model/computer-diff';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api/index';
import { IDocumentDiff } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/documentDiffProvider';

describe('compute diff test', () => {
  const computerDiffModel = new ComputerDiffModel();
  const mock1 = monaco.editor.createModel('const a = 1;');
  const mock2 = monaco.editor.createModel('const b = 1;');

  it('should be work', async () => {
    const result: IDocumentDiff = await computerDiffModel.computeDiff(mock1, mock2);
    expect(result).toBeDefined();
    expect(result.changes.length).toBe(1);

    let originalRange = result.changes[0].originalRange;
    const modifiedRange = result.changes[0].modifiedRange;

    expect(originalRange.toString()).toBe('[1,2)');
    expect(modifiedRange.toString()).toBe('[1,2)');

    expect(originalRange.startLineNumber).toBe(1);
    expect(originalRange.endLineNumberExclusive).toBe(2);
    originalRange = originalRange.delta(1);

    expect(originalRange.startLineNumber).toBe(2);
    expect(originalRange.endLineNumberExclusive).toBe(3);

    const innerChanges = result.changes[0].innerChanges!;
    expect(innerChanges[0].originalRange.toString()).toBe('[1,7 -> 1,8]');
    expect(innerChanges[0].modifiedRange.toString()).toBe('[1,7 -> 1,8]');
  });
});
