import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { IModelDecorationOptions } from '../../monaco-api/editor';

import { LineRange } from './model/line-range';

export interface IBaseCodeEditor {
  mount(): void;
}

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

export interface IActionsDescription {
  range: LineRange;
  decorationOptions: IModelDecorationOptions;
}

export const ACCEPT_CURRENT = 'accpet_current';
export const ACCEPT_COMBINATION = 'accpet_combination';
export const IGNORE = 'ignore';

export interface IActionsProvider {
  onActionsClick?: (
    e: IEditorMouseEvent,
    currentView: IBaseCodeEditor,
    resultView: IBaseCodeEditor,
    incomingView: IBaseCodeEditor,
  ) => void;
  /**
   * 提供 actions 操作项
   */
  provideActionsItems: () => IActionsDescription[];
}
