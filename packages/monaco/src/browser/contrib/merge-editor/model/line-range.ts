import { IRange } from '@opensumi/monaco-editor-core';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange as MonacoLineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

export class LineRange extends MonacoLineRange {
  constructor(startLineNumber: number, endLineNumberExclusive: number) {
    super(startLineNumber, endLineNumberExclusive);
  }

  public get id(): string {
    return `${this.startLineNumber}_${this.endLineNumberExclusive}_${this.length}`;
  }

  public isTendencyRight(refer: LineRange): boolean {
    return this.isEmpty && !refer.isEmpty;
  }

  public isTendencyLeft(refer: LineRange): boolean {
    return !this.isEmpty && refer.isEmpty;
  }

  public isAfter(range: LineRange): boolean {
    return this.startLineNumber >= range.endLineNumberExclusive;
  }

  public isBefore(range: LineRange): boolean {
    return range.startLineNumber >= this.endLineNumberExclusive;
  }

  public equals(range: LineRange): boolean {
    return this.startLineNumber === range.startLineNumber && this.length === range.length;
  }

  public toRange(): IRange {
    if (this.isEmpty) {
      return Range.fromPositions({ lineNumber: this.startLineNumber, column: 0 });
    }

    return Range.fromPositions(
      { lineNumber: this.startLineNumber, column: 0 },
      { lineNumber: this.endLineNumberExclusive - 1, column: Number.MAX_SAFE_INTEGER },
    );
  }

  public override delta(offset: number): LineRange {
    return new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive + offset);
  }
}
