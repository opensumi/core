import { getIcon } from '@opensumi/ide-core-browser';
import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

import { IModelDecorationOptions } from '../../monaco-api/editor';

import { LineRange } from './model/line-range';

export interface IRangeContrast {
  type: LineRangeType;
  // 是否解决操作完成
  get isComplete(): boolean;
  setComplete: (b: boolean) => this;
  /**
   * 表示这个 range 区域是倾向于 current editor 还是 incoming editor（如果本身就是在 current editor 则返回 current）
   * 在 result editor 视图里可以通过该字段来判读它是与 current editor 相比较的还是与 incoming 相比较的 diff
   */
  get turnDirection(): EditorViewType.CURRENT | EditorViewType.INCOMING;
  setTurnDirection: (t: EditorViewType.CURRENT | EditorViewType.INCOMING) => this;
}

export interface IBaseCodeEditor {
  mount(): void;
}

export type LineRangeType = 'insert' | 'modify' | 'remove';

export enum EditorViewType {
  CURRENT = 'current',
  RESULT = 'result',
  INCOMING = 'incoming',
}

export enum EDiffRangeTurn {
  ORIGIN = 'origin',
  MODIFIED = 'modified',
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

export const ACCEPT_CURRENT_ACTIONS = 'accpet_current';
export const ACCEPT_COMBINATION_ACTIONS = 'accpet_combination';
export const IGNORE_ACTIONS = 'ignore';
export const REVOKE_ACTIONS = 'revoke';

export type TActionsType =
  | typeof ACCEPT_CURRENT_ACTIONS
  | typeof ACCEPT_COMBINATION_ACTIONS
  | typeof IGNORE_ACTIONS
  | typeof REVOKE_ACTIONS;

export interface IActionsProvider {
  onActionsClick?: (range: LineRange, actionType: TActionsType) => void;
  mouseDownGuard?: (e: IEditorMouseEvent) => boolean;
  /**
   * 提供 actions 操作项
   */
  provideActionsItems: () => IActionsDescription[];
}

export namespace CONFLICT_ACTIONS_ICON {
  export const RIGHT = `conflict-actions ${ACCEPT_CURRENT_ACTIONS} ${getIcon('doubleright')}`;
  export const LEFT = `conflict-actions ${ACCEPT_CURRENT_ACTIONS} ${getIcon('doubleleft')}`;
  export const CLOSE = `conflict-actions ${IGNORE_ACTIONS} ${getIcon('close')}`;
  export const REVOKE = `conflict-actions ${REVOKE_ACTIONS} ${getIcon('revoke')}`;
}

// 用来寻址点击事件时的标记
export const ADDRESSING_TAG_CLASSNAME = 'ADDRESSING_TAG_CLASSNAME_';

/**
 * 绘制 decoration 和 line widget 线的样式类名集合
 */
export namespace DECORATIONS_CLASSNAME {
  export const combine = (...args: string[]) => args.reduce((pre, cur) => pre + ' ' + cur, ' ');
  // conflict 操作后虚线框的主类名
  export const conflict_wrap = 'conflict-wrap';
  // 用于处理每条 decoration 的虚线框的哪个方向需要不闭合
  export const stretch_top = 'stretch-top';
  export const stretch_bottom = 'stretch-bottom';
  export const stretch_left = 'stretch-left';
  export const stretch_right = 'stretch-right';

  export const margin_className = 'merge-editor-margin-className';
  export const diff_line_background = 'merge-editor-diff-line-background';
  export const diff_inner_char_background = 'merge-editor-diff-inner-char-background';
  export const guide_underline_widget = 'merge-editor-guide-underline-widget';

  export const offset_right = 'offset-right';
  export const offset_left = 'offset-left';
}

export interface IConflictActionsEvent {
  range: LineRange;
  action:
    | typeof ACCEPT_CURRENT_ACTIONS
    | typeof ACCEPT_COMBINATION_ACTIONS
    | typeof IGNORE_ACTIONS
    | typeof REVOKE_ACTIONS;
  withViewType: EditorViewType;
}

/**
 * Time Machine
 */
export interface ITimeMachineMetaData {
  range: LineRange;
  text: string | null;
}
