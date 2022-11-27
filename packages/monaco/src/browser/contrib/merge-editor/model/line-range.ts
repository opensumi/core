import { IRange } from '@opensumi/monaco-editor-core';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange as MonacoLineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

export class LineRange extends MonacoLineRange {
  static fromRange(range: IRange): LineRange {
    return new LineRange(range.startLineNumber, range.endLineNumber);
  }

  constructor(startLineNumber: number, endLineNumberExclusive: number) {
    super(startLineNumber, endLineNumberExclusive);
  }

  public get id(): string {
    return `${this.startLineNumber}_${this.endLineNumberExclusive}_${this.length}`;
  }

  public calcMargin(range: LineRange): number {
    return this.length - range.length;
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

  public isInclude(range: LineRange | Range): boolean {
    if (range instanceof LineRange) {
      return (
        this.startLineNumber <= range.startLineNumber && this.endLineNumberExclusive >= range.endLineNumberExclusive
      );
    } else if (range instanceof Range) {
      if (this.isEmpty) {
        return false;
      }
      return this.startLineNumber <= range.startLineNumber && this.endLineNumberExclusive >= range.endLineNumber;
    }
    return false;
  }

  public equals(range: LineRange): boolean {
    return this.startLineNumber === range.startLineNumber && this.length === range.length;
  }

  public toRange(startColumn = 0, endColumn: number = Number.MAX_SAFE_INTEGER): IRange {
    if (this.isEmpty) {
      return Range.fromPositions({ lineNumber: this.startLineNumber, column: startColumn });
    }

    return Range.fromPositions(
      { lineNumber: this.startLineNumber, column: startColumn },
      { lineNumber: this.endLineNumberExclusive - 1, column: endColumn },
    );
  }

  public override delta(offset: number): LineRange {
    return new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive + offset);
  }

  public deltaStart(offset: number): LineRange {
    return new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive);
  }

  public deltaEnd(offset: number): LineRange {
    return new LineRange(this.startLineNumber, this.endLineNumberExclusive + offset);
  }
}
