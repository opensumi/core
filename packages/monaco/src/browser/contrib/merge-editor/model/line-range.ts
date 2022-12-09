import { IRange } from '@opensumi/monaco-editor-core';
import { LineRange as MonacoLineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

import { EditorViewType, IRangeContrast, LineRangeType } from '../types';

import { InnerRange } from './inner-range';

export class LineRange extends MonacoLineRange implements IRangeContrast {
  static fromPositions(startLineNumber: number, endLineNumber: number = startLineNumber): LineRange {
    return new LineRange(startLineNumber, endLineNumber);
  }

  private _id: string;
  public get id(): string {
    return this._id;
  }

  private _type: LineRangeType;
  public get type(): LineRangeType {
    return this._type;
  }

  private _isComplete: boolean;
  public get isComplete(): boolean {
    return this._isComplete;
  }

  private _turnDirection: EditorViewType.CURRENT | EditorViewType.INCOMING;
  public get turnDirection(): EditorViewType.CURRENT | EditorViewType.INCOMING {
    return this._turnDirection;
  }

  constructor(startLineNumber: number, endLineNumberExclusive: number) {
    super(startLineNumber, endLineNumberExclusive);
    this._type = 'insert';
    this._isComplete = false;
    this._id = `${this.startLineNumber}_${this.endLineNumberExclusive}_${this.length}`;
  }

  private setId(id: string): this {
    this._id = id;
    return this;
  }

  public setTurnDirection(t: EditorViewType.CURRENT | EditorViewType.INCOMING) {
    this._turnDirection = t;
    return this;
  }

  public setComplete(b: boolean): this {
    this._isComplete = b;
    return this;
  }

  public setType(v: LineRangeType): this {
    this._type = v;
    return this;
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

  public isTouches(range: LineRange): boolean {
    return this.endLineNumberExclusive >= range.startLineNumber && range.endLineNumberExclusive >= this.startLineNumber;
  }

  public isInclude(range: LineRange | InnerRange): boolean {
    if (range instanceof LineRange) {
      return (
        this.startLineNumber <= range.startLineNumber && this.endLineNumberExclusive >= range.endLineNumberExclusive
      );
    } else if (range instanceof InnerRange) {
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

  public merge(other: LineRange): LineRange {
    return this.retainState(
      new LineRange(
        Math.min(this.startLineNumber, other.startLineNumber),
        Math.max(this.endLineNumberExclusive, other.endLineNumberExclusive),
      ),
    );
  }

  public toRange(startColumn = 0, endColumn: number = Number.MAX_SAFE_INTEGER): IRange {
    if (this.isEmpty) {
      return InnerRange.fromPositions({ lineNumber: this.startLineNumber, column: startColumn }).setType(this._type);
    }

    return InnerRange.fromPositions(
      { lineNumber: this.startLineNumber, column: startColumn },
      { lineNumber: this.endLineNumberExclusive - 1, column: endColumn },
    ).setType(this._type);
  }

  private retainState(range: LineRange): LineRange {
    return range
      .setId(this._id)
      .setType(this._type)
      .setTurnDirection(this._turnDirection)
      .setComplete(this._isComplete);
  }

  public override delta(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive + offset));
  }

  public deltaStart(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber + offset, this.endLineNumberExclusive));
  }

  public deltaEnd(offset: number): LineRange {
    return this.retainState(new LineRange(this.startLineNumber, this.endLineNumberExclusive + offset));
  }
}
