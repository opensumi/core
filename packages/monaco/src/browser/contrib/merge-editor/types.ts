import { getIcon } from '@opensumi/ide-core-browser';
import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { IModelDecorationOptions } from '../../monaco-api/editor';

import { LineRange } from './model/line-range';

export interface IRangeContrast {
  type: LineRangeType;
}

export interface IBaseCodeEditor {
  mount(): void;
}

export type LineRangeType = 'insert' | 'modify' | 'remove';

export enum EditorViewType {
  CURRENT,
  RESULT,
  INCOMING,
}

export enum EDiffRangeTurn {
  ORIGIN,
  MODIFIED,
}

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
  decorationOptions: Omit<IModelDecorationOptions, 'description'>;
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
  ) => boolean;
  mouseDownGuard?: (e: IEditorMouseEvent) => boolean;
  /**
   * 提供 actions 操作项
   */
  provideActionsItems: () => IActionsDescription[];
}

export namespace CONFLICT_ACTIONS_ICON {
  export const RIGHT = `conflict-actions ${ACCEPT_CURRENT} ${getIcon('right')}`;
  export const LEFT = `conflict-actions ${ACCEPT_CURRENT} ${getIcon('left')}`;
  export const CLOSE = `conflict-actions ${IGNORE} ${getIcon('close')}`;
}

export interface IConflictActionsEvent {
  range: LineRange;
  action: typeof ACCEPT_CURRENT | typeof ACCEPT_COMBINATION | typeof IGNORE;
  withViewType: EditorViewType;
}
