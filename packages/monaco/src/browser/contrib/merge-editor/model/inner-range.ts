import { Range as MonacoRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { IPosition } from '../../../monaco-api/types';
import { IRangeContrast, LineRangeType } from '../types';

export class InnerRange extends MonacoRange implements IRangeContrast {
  static fromPositions(start: IPosition, end: IPosition = start): InnerRange {
    return new InnerRange(start.lineNumber, start.column, end.lineNumber, end.column);
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
