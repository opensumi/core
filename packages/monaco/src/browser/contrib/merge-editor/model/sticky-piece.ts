import { IStickyPiece, IStickyPiecePath, IStickyPiecePosition, LineRangeType } from '../types';

export class StickyPieceModel implements IStickyPiece {
  private _width: number;
  private _height: number;
  private _path: IStickyPiecePath;
  private _position: IStickyPiecePosition;
  private _rangeType: LineRangeType;
  private _isComplete: boolean;
  private readonly rawData: Readonly<IStickyPiece>;

  public get width(): number {
    return this._width;
  }
  public get height(): number {
    return this._height;
  }
  public get path(): IStickyPiecePath {
    return this._path;
  }
  public get position(): IStickyPiecePosition {
    return this._position;
  }
  public get rangeType(): LineRangeType {
    return this._rangeType;
  }

  public get isComplete(): boolean {
    return this._isComplete;
  }

  constructor(
    width: number,
    height: number,
    path: IStickyPiecePath,
    position: IStickyPiecePosition,
    rangeType: LineRangeType,
    isComplete?: boolean,
  ) {
    this._width = width;
    this._height = height;
    this._path = path;
    this._position = position;
    this._rangeType = rangeType;
    this._isComplete = !!isComplete;
    this.rawData = Object.freeze({
      rangeType,
      width,
      height,
      position,
      path,
    });
  }

  private calcHeight(leftOffest: number, rightOffest: number): number {
    const { leftTop, rightTop, leftBottom, rightBottom } = this.rawData.path;

    const minTop = Math.min(leftTop - leftOffest, rightTop - rightOffest);
    const maxBottom = Math.max(leftBottom - leftOffest, rightBottom - rightOffest);
    return Math.abs(maxBottom - minTop);
  }

  private calcPath(leftOffest: number, rightOffest: number): IStickyPiecePath {
    const { path: rawPath } = this.rawData;

    const offestLT = rawPath.leftTop - leftOffest;
    const offestRT = rawPath.rightTop - rightOffest;

    const leftTop = Math.max(0, offestLT - offestRT);
    const rightTop = Math.max(0, offestRT - offestLT);
    const leftBottom = Math.min(this.height, leftTop + (rawPath.leftBottom - rawPath.leftTop));
    const rightBottom = Math.min(this.height, rightTop + (rawPath.rightBottom - rawPath.rightTop));

    return {
      leftTop,
      rightTop,
      leftBottom,
      rightBottom,
    };
  }

  public movePosition(leftOffest: number, rightOffest: number): this {
    const rawTop = this.rawData.position.top;
    const { leftTop, rightTop } = this.rawData.path;

    const top = rawTop + Math.min(leftTop - leftOffest, rightTop - rightOffest);
    this._position = { top };
    this._height = this.calcHeight(leftOffest, rightOffest);
    this._path = this.calcPath(leftOffest, rightOffest);
    return this;
  }
}
