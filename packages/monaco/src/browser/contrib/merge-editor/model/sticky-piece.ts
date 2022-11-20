import clone from 'lodash/clone';

import { IStickyPiece, IStickyPiecePath, IStickyPiecePosition, LineRangeType } from '../types';

export class StickyPieceModel implements IStickyPiece {
  private _width: number;
  private _height: number;
  private _path: IStickyPiecePath;
  private _position: IStickyPiecePosition;
  private _rangeType: LineRangeType;
  private readonly rawData: IStickyPiece;

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

  constructor(
    width: number,
    height: number,
    path: IStickyPiecePath,
    position: IStickyPiecePosition,
    rangeType: LineRangeType,
  ) {
    this._width = width;
    this._height = height;
    this._path = path;
    this._position = position;
    this._rangeType = rangeType;
    this.rawData = Object.freeze({
      rangeType: clone(rangeType),
      width: clone(width),
      height: clone(height),
      position: Object.freeze(clone(position)),
      path: Object.freeze(clone(path)),
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

    const offestLeftTop = rawPath.leftTop - leftOffest;
    const offestRightTop = rawPath.rightTop - rightOffest;

    const leftTop = Math.max(0, offestLeftTop - offestRightTop);
    const rightTop = Math.max(0, offestRightTop - offestLeftTop);
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

    const top = Math.min(rawTop + leftTop - leftOffest, rawTop + rightTop - rightOffest);
    this._position = { top };
    this._height = this.calcHeight(leftOffest, rightOffest);
    this._path = this.calcPath(leftOffest, rightOffest);
    return this;
  }
}
