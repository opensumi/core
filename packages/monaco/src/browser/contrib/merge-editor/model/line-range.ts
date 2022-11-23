import { IRange } from '@opensumi/monaco-editor-core';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange as MonacoLineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

export class LineRange extends MonacoLineRange {
  constructor(startLineNumber: number, endLineNumberExclusive: number) {
    super(startLineNumber, endLineNumberExclusive);
  }

  public isTendencyRight(refer: LineRange): boolean {
    return this.isEmpty && !refer.isEmpty;
  }

  public isTendencyLeft(refer: LineRange): boolean {
    return !this.isEmpty && refer.isEmpty;
  }

  public toIRange(): IRange {
    return Range.fromPositions(
      { lineNumber: this.startLineNumber, column: 0 },
      { lineNumber: this.endLineNumberExclusive - 1, column: 0 },
    );
  }
}
