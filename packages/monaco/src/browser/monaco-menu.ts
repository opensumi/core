import { EDITOR_COMMANDS } from '@opensumi/ide-core-browser';

export interface MonacoActionGroup {
  id: string;
  actions: string[];
}

export namespace MonacoMenus {
  export const SELECTION_GROUP: MonacoActionGroup = {
    id: '1_selection_group',
    actions: [EDITOR_COMMANDS.SELECT_ALL.id, 'editor.action.smartSelect.expand', 'editor.action.smartSelect.shrink'],
  };

  export const SELECTION_MOVE_GROUP: MonacoActionGroup = {
    id: '2_copy_move_group',
    actions: [
      'editor.action.copyLinesUpAction',
      'editor.action.copyLinesDownAction',
      'editor.action.moveLinesUpAction',
      'editor.action.moveLinesDownAction',
    ],
  };

  export const SELECTION_CURSOR_GROUP: MonacoActionGroup = {
    id: '3_cursor_group',
    actions: [
      'editor.action.insertCursorAbove',
      'editor.action.insertCursorBelow',
      'editor.action.insertCursorAtEndOfEachLineSelected',
      'editor.action.addSelectionToNextFindMatch',
      'editor.action.addSelectionToPreviousFindMatch',
      'editor.action.selectHighlights',
    ],
  };

  export const SELECTION_GROUPS = [SELECTION_GROUP, SELECTION_MOVE_GROUP, SELECTION_CURSOR_GROUP];
}
