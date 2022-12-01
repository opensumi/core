import { InnerRange } from './model/inner-range';
import { LineRange } from './model/line-range';
import { LineRangeMapping } from './model/line-range-mapping';
import { EditorViewType } from './types';

export const flatOriginal = (changes: LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.originalRange as LineRange);

export const flatInnerOriginal = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.originalRange as InnerRange));

export const flatModified = (changes: LineRangeMapping[]): LineRange[] =>
  changes.map((c) => c.modifiedRange as LineRange);

export const flatInnerModified = (changes: LineRangeMapping[]): InnerRange[][] =>
  changes
    .map((c) => c.innerChanges)
    .filter(Boolean)
    .map((m) => m!.map((m) => m.modifiedRange as InnerRange));

// 标识当前是哪个编辑器视图类型的类名选择器（目前是拿来绘制 conflict action 操作完之后的虚线框效果）
export const getEditorViewTypeClassName = (editorViewType: EditorViewType) => `editor-view-${editorViewType}-type`;
