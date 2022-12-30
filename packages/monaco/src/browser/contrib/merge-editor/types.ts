import { getExternalIcon, getIcon } from '@opensumi/ide-core-browser';
import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ICodeEditorViewState } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import { IModelDecorationOptions } from '../../monaco-api/editor';

import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';
import styles from './view/merge-editor.module.less';

export interface IRangeContrast {
  type: LineRangeType;
  /**
   * 是否解决操作完成
   */
  get isComplete(): boolean;
  setComplete: (b: boolean) => this;
  /**
   * 表示这个 range 区域是倾向于 current editor 还是 incoming editor（如果本身就是在 current editor 则返回 current）
   * 在 result editor 视图里可以通过该字段来判读它是与 current editor 相比较的还是与 incoming 相比较的 diff
   * 当然也有可能是两者都有，这种情况一般是 merge 合成后的 range
   */
  get turnDirection(): ETurnDirection;
  setTurnDirection: (t: ETurnDirection) => this;
}

export interface IBaseCodeEditor {
  mount(): void;
}

export type LineRangeType = 'insert' | 'modify' | 'remove';

export enum ETurnDirection {
  BOTH = 'both',
  CURRENT = 'current',
  INCOMING = 'incoming',
}

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

/**
 * 绘制 decoration 和 line widget 线的样式类名集合
 */
export namespace DECORATIONS_CLASSNAME {
  export const combine = (...args: string[]) => args.reduce((pre, cur) => pre + ' ' + cur, ' ');
  // conflict 操作后虚线框的主类名
  export const conflict_wrap = styles.conflict_wrap;
  // 用于处理每条 decoration 的虚线框的哪个方向需要不闭合
  export const stretch_top = styles.stretch_top;
  export const stretch_bottom = styles.stretch_bottom;
  export const stretch_left = styles.stretch_left;
  export const stretch_right = styles.stretch_right;

  export const margin_className = styles.merge_editor_margin_className;
  export const diff_line_background = styles.merge_editor_diff_line_background;
  export const diff_inner_char_background = styles.merge_editor_diff_inner_char_background;
  export const guide_underline_widget = styles.merge_editor_guide_underline_widget;

  export const offset_right = styles.offset_right;
  export const offset_left = styles.offset_left;

  export const rotate_turn_left = styles.rotate_turn_left;
  export const rotate_turn_right = styles.rotate_turn_right;

  export const range_type: { [key in LineRangeType]: string } = {
    insert: styles.insert,
    modify: styles.modify,
    remove: styles.remove,
  };

  export const dashed = styles.dashed;
}

export const ACCEPT_CURRENT_ACTIONS = 'accpet_current';
export const ACCEPT_COMBINATION_ACTIONS = 'accpet_combination';
export const IGNORE_ACTIONS = 'ignore';
export const REVOKE_ACTIONS = 'revoke';
export const APPEND_ACTIONS = 'append';

export type TActionsType =
  | typeof ACCEPT_CURRENT_ACTIONS
  | typeof ACCEPT_COMBINATION_ACTIONS
  | typeof IGNORE_ACTIONS
  | typeof REVOKE_ACTIONS
  | typeof APPEND_ACTIONS;

export interface IActionsProvider {
  onActionsClick?: (range: LineRange, actionType: TActionsType) => void;
  mouseDownGuard?: (e: IEditorMouseEvent) => boolean;
  /**
   * 提供 actions 操作项
   */
  provideActionsItems: () => IActionsDescription[];
}

export namespace CONFLICT_ACTIONS_ICON {
  const ACTIONS = styles.conflict_actions;

  export const RIGHT = `${ACTIONS} ${ACCEPT_CURRENT_ACTIONS} ${getIcon('doubleright')}`;
  export const ROTATE_RIGHT = `${ACTIONS} ${APPEND_ACTIONS} ${DECORATIONS_CLASSNAME.rotate_turn_right}  ${getIcon(
    'doubleright',
  )}`;
  export const LEFT = `${ACTIONS} ${ACCEPT_CURRENT_ACTIONS} ${getIcon('doubleleft')}`;
  export const ROTATE_LEFT = `${ACTIONS} ${APPEND_ACTIONS} ${DECORATIONS_CLASSNAME.rotate_turn_left}  ${getIcon(
    'doubleleft',
  )}`;
  export const WAND = `${ACTIONS} ${ACCEPT_COMBINATION_ACTIONS} ${getExternalIcon('wand')}`;
  export const CLOSE = `${ACTIONS} ${IGNORE_ACTIONS} ${getIcon('close')}`;
  export const REVOKE = `${ACTIONS} ${REVOKE_ACTIONS} ${getIcon('revoke')}`;
}

// 用来寻址点击事件时的标记
export const ADDRESSING_TAG_CLASSNAME = 'ADDRESSING_TAG_CLASSNAME_';

export interface IConflictActionsEvent {
  range: LineRange;
  action: TActionsType;
  withViewType: EditorViewType;
}

/**
 * Time Machine
 */
export interface ITimeMachineMetaData {
  range: LineRange;
  text: string | null;
}

/**
 * View State
 */
export interface IMergeEditorViewState {
  [EditorViewType.CURRENT]: ICodeEditorViewState | null;
  [EditorViewType.RESULT]: ICodeEditorViewState | null;
  [EditorViewType.INCOMING]: ICodeEditorViewState | null;
  turnLeft: LineRangeMapping[];
  turnRight: LineRangeMapping[];
}
