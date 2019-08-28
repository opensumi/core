import { Command, localize } from '..';

export namespace FILE_COMMANDS {
  const CATEGORY = localize('file');

  export const NEW_FILE: Command = {
    id: 'file.new',
    category: CATEGORY,
    label: localize('file.new'),
    iconClass: 'new_file',
  };

  export const RENAME_FILE: Command = {
    id: 'file.rename',
    category: CATEGORY,
    label: localize('file.rename'),
  };

  export const DELETE_FILE: Command = {
    id: 'file.delete',
    category: CATEGORY,
    label: localize('file.delete'),
  };

  export const NEW_FOLDER: Command = {
    id: 'file.folder.new',
    category: CATEGORY,
    label: localize('file.folder.new'),
    iconClass: 'new_folder',
  };

  export const COMPARE_SELECTED: Command = {
    id: 'file.compare',
    category: CATEGORY,
    label: localize('file.compare'),
    iconClass: 'new_folder',
  };

  export const COLLAPSE_ALL: Command = {
    id: 'filetree.collapse.all',
    category: CATEGORY,
    label: localize('file.collapse'),
    iconClass: 'collapse_explorer',
  };

  export const REFRESH_ALL: Command = {
    id: 'filetree.refresh.all',
    category: CATEGORY,
    label: localize('file.refresh'),
    iconClass: 'refresh_explorer',
  };

  export const OPEN_RESOURCES: Command = {
    id: 'filetree.open.file',
    category: CATEGORY,
    label: localize('file.open'),
  };
}

export namespace COMMON_COMMANDS {

  export const FIND: Command = {
    id: 'core.find',
    label: 'Find',
  };

  export const REPLACE: Command = {
    id: 'core.replace',
    label: 'Replace',
  };

  export const ABOUT_COMMAND: Command = {
    id: 'core.about',
    label: localize('about'),
  };

  export const OPEN_PREFERENCES: Command = {
    id: 'core.openpreference',
    label: localize('openpreference'),
  };
}

export namespace EXPLORER_COMMANDS {
  const CATEGORY = localize('explorer');

  export const LOCATION: Command = {
    id: 'explorer.location',
    category: CATEGORY,
    label: localize('explorer.location'),
  };
}

export namespace EDITOR_COMMANDS {
  const CATEGORY = localize('editor');

  export const UNDO: Command = {
    id: 'editor.undo',
    category: CATEGORY,
    label: localize('editor.undo'),
  };
  export const REDO: Command = {
    id: 'editor.redo',
    category: CATEGORY,
    label: localize('editor.redo'),
  };

  export const OPEN_RESOURCE: Command = {
    id: 'editor.openUri',
    category: CATEGORY,
  };

  export const OPEN_RESOURCES: Command = {
    id: 'editor.openUris',
    category: CATEGORY,
  };

  export const SAVE_CURRENT: Command = {
    id: 'editor.saveCurrent',
    category: CATEGORY,
    label: localize('editor.saveCurrent'),
  };

  export const COMPARE: Command = {
    id: 'editor.compare',
    category: CATEGORY,
  };

  export const CLOSE: Command = {
    id: 'editor.close',
    category: CATEGORY,
    label: localize('editor.closeCurrent'),
  };

  export const CLOSE_ALL_IN_GROUP: Command = {
    id: 'editor.closeAllInGroup',
    category: CATEGORY,
    label: localize('editor.closeAllInGroup'),
  };

  export const CLOSE_OTHER_IN_GROUP: Command = {
    id: 'editor.closeOtherEditorsInGroup',
    category: CATEGORY,
    label: localize('editor.closeOtherEditors', '关闭组中其他编辑器'),
  };

  export const CLOSE_TO_RIGHT: Command = {
    id: 'editor.closeToRight',
    category: CATEGORY,
  };

  export const GET_CURRENT: Command = {
    id: 'editor.getCurrent',
    category: CATEGORY,
  };

  export const SPLIT_TO_LEFT: Command = {
    id: 'editor.splitToLeft',
    category: CATEGORY,
  };

  export const SPLIT_TO_RIGHT: Command = {
    id: 'editor.splitToRight',
    category: CATEGORY,
  };

  export const SPLIT_TO_TOP: Command = {
    id: 'editor.splitToTop',
    category: CATEGORY,
  };

  export const SPLIT_TO_BOTTOM: Command = {
    id: 'editor.splitToBottom',
    category: CATEGORY,
  };

  export const CHANGE_LANGUAGE: Command = {
    id: 'editor.changeLanguage',
    category: CATEGORY,
  };

  export const CHANGE_ENCODING: Command = {
    id: 'editor.changeEncoding',
    category: CATEGORY,
  };

  export const CHANGE_EOL: Command = {
    id: 'editor.changeEol',
    category: CATEGORY,
  };

  export const NAVIGATE_LEFT: Command = {
    id: 'editor.navigateLeft',
    category: CATEGORY,
  };

  export const NAVIGATE_RIGHT: Command = {
    id: 'editor.navigateRight',
    category: CATEGORY,
  };

  export const NAVIGATE_UP: Command = {
    id: 'editor.navigateUp',
    category: CATEGORY,
  };

  export const NAVIGATE_DOWN: Command = {
    id: 'editor.navigateDown',
    category: CATEGORY,
  };

  export const NAVIGATE_NEXT: Command = {
    id: 'editor.navigateNext',
    category: CATEGORY,
  };

  export const PREVIOUS: Command = {
    id: 'editor.previous',
    category: CATEGORY,
  };

  export const NEXT: Command = {
    id: 'editor.next',
    category: CATEGORY,
  };

  export const PREVIOUS_IN_GROUP: Command = {
    id: 'editor.previousInGroup',
    category: CATEGORY,
  };

  export const NEXT_IN_GROUP: Command = {
    id: 'editor.nextInGroup',
    category: CATEGORY,
  };

  export const LAST_IN_GROUP: Command = {
    id: 'editor.lastInGroup',
    category: CATEGORY,
  };

  export const CLOSE_OTHER_GROUPS: Command = {
    id: 'editor.closeOtherGroup',
    category: CATEGORY,
    label: localize('closeEditorsInOtherGroups', '关闭其他组中的编辑器'),
  };

  export const OPEN_EDITOR_AT_INDEX: Command = {
    id: 'editor.openEditorAtIndex',
    category: CATEGORY,
  };

  export const EVEN_EDITOR_GROUPS: Command = {
    id: 'editor.evenEditorGroups',
    category: CATEGORY,
    label: localize('evenEditorGroups',  '重置编辑器组大小'),  // TODO command注册支持国际化格式
  };

  export const REVERT_DOCUMENT: Command = {
    id: 'editor.document.revert',
    category: CATEGORY,
    label: localize('revert',  '还原文档'),  // TODO command注册支持国际化格式
  };

  export const REVERT_AND_CLOSE: Command = {
    id: 'editor.revertAndClose',
    category: CATEGORY,
  };

}

export namespace SCM_COMMANDS {
  const CATEGORY = localize('scm');

  export const ACCCEPT_INPUT: Command = {
    id: 'scm.acceptInput',
    category: CATEGORY,
    label: localize('scm.acceptInput'),
  };
}
