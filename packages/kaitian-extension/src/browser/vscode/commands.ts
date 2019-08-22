import {
  Command,
  EDITOR_COMMANDS,
  FILE_COMMANDS,
} from '@ali/ide-core-browser';

export namespace VscodeCommands {
  export const SET_CONTEXT: Command = {
      id: 'setContext',
  };

  export const WORKBENCH_CLOSE_ACTIVE_EDITOR: Command = {
    id: 'workbench.action.closeActiveEditor',
    delegate: EDITOR_COMMANDS.CLOSE.id,
  };

  export const REVERT_AND_CLOSE_ACTIVE_EDITOR: Command = {
    id: 'workbench.action.revertAndCloseActiveEditor',
    delegate: EDITOR_COMMANDS.REVERT_AND_CLOSE.id,
  };

  export const SPLIT_EDITOR_RIGHT: Command = {
    id: 'workbench.action.splitEditorRight',
    delegate: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
  };

  export const SPLIT_EDITOR_DOWN: Command = {
    id: 'workbench.action.splitEditorDown',
    delegate: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
  };

  export const NEW_UNTITLED_FILE: Command = {
    id: 'workbench.action.files.newUntitledFile',
    delegate: FILE_COMMANDS.NEW_FILE.id,
  };

  export const CLOSE_ALL_EDITORS: Command = {
    id: 'workbench.action.closeAllEditors',
    delegate: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
  };

  export const CLOSE_OTHER_EDITORS: Command = {
    id: 'workbench.action.closeOtherEditors',
    delegate: EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP.id,
  };

  export const FILE_SAVE: Command = {
    id: 'workbench.action.files.save',
    delegate: EDITOR_COMMANDS.SAVE_CURRENT.id,
  };

  export const SPLIT_EDITOR: Command = {
    id: 'workbench.action.splitEditor',
    // 默认打开右侧
    delegate: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
  };

  export const SPLIT_EDITOR_ORTHOGONAL: Command = {
    id: 'workbench.action.splitEditorOrthogonal',
    // 默认打开下侧
    delegate: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
  };

  export const NAVIGATE_LEFT: Command = {
    id: 'workbench.action.navigateLeft',
    // 默认打开下侧
    delegate: EDITOR_COMMANDS.NAVIGATE_LEFT.id,
  };

  export const NAVIGATE_UP: Command = {
    id: 'workbench.action.navigateUp',
    delegate: EDITOR_COMMANDS.NAVIGATE_UP.id,
  };

  export const NAVIGATE_RIGHT: Command = {
    id: 'workbench.action.navigateRight',
    delegate: EDITOR_COMMANDS.NAVIGATE_RIGHT.id,
  };

  export const NAVIGATE_DOWN: Command = {
    id: 'workbench.action.navigateDown',
    delegate: EDITOR_COMMANDS.NAVIGATE_DOWN.id,
  };

  export const NAVIGATE_NEXT: Command = {
    id: 'workbench.action.navigateEditorGroups',
    delegate: EDITOR_COMMANDS.NAVIGATE_NEXT.id,
  };

  export const NEXT_EDITOR: Command = {
    id: 'workbench.action.nextEditor',
    delegate: EDITOR_COMMANDS.NEXT.id,
  };

  export const PREVIOUS_EDITOR: Command = {
    id: 'workbench.action.previousEditor',
    delegate: EDITOR_COMMANDS.PREVIOUS.id,
  };

  export const PREVIOUS_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.previousEditorInGroup',
    delegate: EDITOR_COMMANDS.PREVIOUS_IN_GROUP.id,
  };

  export const NEXT_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.nextEditorInGroup',
    delegate: EDITOR_COMMANDS.NEXT_IN_GROUP.id,
  };

  export const LAST_EDITOR_IN_GROUP: Command = {
    id: 'workbench.action.lastEditorInGroup',
    delegate: EDITOR_COMMANDS.LAST_IN_GROUP.id,
  };

  export const EVEN_EDITOR_WIDTH: Command = {
    id: 'workbench.action.eventEditorWidths',
    delegate: EDITOR_COMMANDS.EVEN_EDITOR_GROUPS.id,
  };

  export const CLOSE_OTHER_GROUPS: Command = {
    id: 'workbench.action.closeEditorsInOtherGroups',
    delegate: EDITOR_COMMANDS.EVEN_EDITOR_GROUPS.id,
  };

  export const OPEN_EDITOR_AT_INDEX: Command = {
    id: 'workbench.action.openEditorAtIndex',
    delegate: EDITOR_COMMANDS.OPEN_EDITOR_AT_INDEX.id,
  };

  export const REVERT_FILES: Command = {
    id: 'workbench.action.files.revert',
    delegate: EDITOR_COMMANDS.REVERT_DOCUMENT.id,
  };

  // 打开内容
  export const OPEN: Command = {
    id: 'vscode.open',
  };

  // 比较内容
  export const DIFF: Command = {
    id: 'vscode.diff',
  };
}
