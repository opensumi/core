export type LineRangeType = 'insert' | 'modify' | 'remove';

export type EditorViewType = 'current' | 'result' | 'incoming';

export interface IStickyPiece {
  rangeType: LineRangeType;
  width: number;
  height: number;
  position: {
    top: number;
  };
  path: {
    leftTop: number;
    rightTop: number;
    leftBottom: number;
    rightBottom: number;
  };
}
