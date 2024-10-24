import { ICodeEditor, IModelDeltaDecoration, IRange, TrackedRangeStickiness } from '@opensumi/ide-monaco';

import { EnhanceDecorationsCollection } from '../../../model/enhanceDecorationsCollection';
import { REWRITE_DECORATION_INLINE_ADD } from '../../../widget/rewrite/rewrite-widget';
import { IMultiLineDiffChangeResult } from '../diff-computer';
import styles from '../intelligent-completions.module.less';

export class AdditionsDeletionsDecorationModel {
  private deletionsDecorations: EnhanceDecorationsCollection;
  private additionsDecorations: EnhanceDecorationsCollection;

  constructor(private readonly editor: ICodeEditor) {
    this.deletionsDecorations = new EnhanceDecorationsCollection(this.editor);
    this.additionsDecorations = new EnhanceDecorationsCollection(this.editor);
  }

  private generateRange(wordChanges: IMultiLineDiffChangeResult[], zoneRange: IRange, eol: string) {
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
        currentColumn = endColumn;
        currentLineNumber = endLineNumber;
      }

      if (!change.removed) {
        currentColumn = endColumn;
        currentLineNumber = endLineNumber;
      }
    }

    return ranges;
  }

  clearDeletionsDecorations() {
    this.deletionsDecorations.clear();
  }

  clearAdditionsDecorations() {
    this.additionsDecorations.clear();
  }

  updateDeletionsDecoration(wordChanges: IMultiLineDiffChangeResult[], range: IRange, eol: string) {
    const deletionRanges = this.generateRange(
      wordChanges.map((change) => {
        const value = change.value;

        if (change.removed) {
          return { value, added: true };
        } else if (change.added) {
          return { value, removed: true };
        }

        return change;
      }),
      range,
      eol,
    );

    this.deletionsDecorations.set(
      deletionRanges.map((range) => ({
        range,
        options: {
          description: 'suggestion_deletions_background',
          className: styles.suggestion_deletions_background,
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      })),
    );
  }

  updateAdditionsDecoration(additionRanges: IRange[]) {
    this.additionsDecorations.set(
      additionRanges.map((range) => ({
        range,
        options: {
          description: REWRITE_DECORATION_INLINE_ADD,
          className: styles.suggestion_additions_background,
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      })),
    );
  }
}
