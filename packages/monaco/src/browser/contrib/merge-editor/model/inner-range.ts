import { Range as MonacoRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { IPosition } from '../../../monaco-api/types';
import { ECompleteReason, ETurnDirection, IRangeContrast, LineRangeType } from '../types';

export class InnerRange extends MonacoRange implements IRangeContrast {
  private _isComplete: boolean;
  public get isComplete(): boolean {
    return this._isComplete;
  }

  private _completeReason: ECompleteReason | undefined;
  public get completeReason(): ECompleteReason | undefined {
    return this._completeReason;
  }

  private _turnDirection: ETurnDirection;
  public get turnDirection(): ETurnDirection {
    return this._turnDirection;
  }

  static fromPositions(start: IPosition, end: IPosition = start): InnerRange {
    return new InnerRange(start.lineNumber, start.column, end.lineNumber, end.column);
  }

  public setTurnDirection(t: ETurnDirection) {
    this._turnDirection = t;
    return this;
  }

  public done(reason: ECompleteReason): this {
    this._isComplete = true;
    this._completeReason = reason;
    return this;
  }

  public cancel(): this {
    this._isComplete = false;
    this._completeReason = undefined;
    return this;
  }

  private _type: LineRangeType;
  public get type(): LineRangeType {
    return this._type;
  }

  constructor(startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
    super(startLineNumber, startColumn, endLineNumber, endColumn);
    this._type = 'insert';
  }

  public setType(v: LineRangeType): this {
    this._type = v;
    return this;
  }
}
