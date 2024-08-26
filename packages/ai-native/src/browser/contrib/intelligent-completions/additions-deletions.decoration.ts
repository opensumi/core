import { ICodeEditor, IModelDeltaDecoration, IRange } from '@opensumi/ide-monaco';

import { EnhanceDecorationsCollection } from '../../model/enhanceDecorationsCollection';

import { IMultiLineDiffChangeResult } from './diff-computer';

export class AdditionsDeletionsDecorationModel {
  private deletionsDecorations: EnhanceDecorationsCollection;

  constructor(private readonly editor: ICodeEditor) {
    this.deletionsDecorations = new EnhanceDecorationsCollection(this.editor);
  }

  generateRange(wordChanges: IMultiLineDiffChangeResult[], zoneRange: IRange, eol: string) {
    const ranges: IRange[] = [];

    let currentLineNumber = 1;
    let currentColumn = 1;
    for (const change of wordChanges) {
      const lines = change.value.split(eol);
      const len = lines.length;

      const endLineNumber = currentLineNumber + len - 1;
      const endColumn = len > 1 ? lines[len - 1].length + 1 : currentColumn + change.value.length;

      if (change.added) {
        ranges.push({
          startLineNumber: currentLineNumber + zoneRange.startLineNumber - 1,
          startColumn: currentColumn,
          endLineNumber: endLineNumber + zoneRange.startLineNumber - 1,
          endColumn,
        });
      }

      currentColumn = endColumn;
      currentLineNumber = endLineNumber;
    }
    return ranges;
  }

  setDeletionsDecoration(decoration: IModelDeltaDecoration[]) {
    this.deletionsDecorations.set(decoration);
  }
}
