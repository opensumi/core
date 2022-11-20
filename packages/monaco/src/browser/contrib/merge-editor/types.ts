export type LineRangeType = 'insert' | 'modify' | 'remove';

export type EditorViewType = 'current' | 'result' | 'incoming';

export interface IStickyPiecePosition {
  top: number;
}

export interface IStickyPiecePath {
  leftTop: number;
  rightTop: number;
  leftBottom: number;
  rightBottom: number;
}

export interface IStickyPiece {
  rangeType: LineRangeType;
  width: number;
  height: number;
  position: IStickyPiecePosition;
  path: IStickyPiecePath;
}
