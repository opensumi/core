import { DragOverPosition, EditorGroupSplitAction } from './editor';

export function getSplitActionFromDragDrop(position: DragOverPosition): EditorGroupSplitAction {
  return {
    [DragOverPosition.LEFT]: EditorGroupSplitAction.Left,
    [DragOverPosition.RIGHT]: EditorGroupSplitAction.Right,
    [DragOverPosition.BOTTOM]: EditorGroupSplitAction.Bottom,
    [DragOverPosition.TOP]: EditorGroupSplitAction.Top,
  }[position];
}
