import { Command, localize } from '..';
import { getIcon } from '../style/icon/icon';

export namespace FILE_COMMANDS {
  const CATEGORY = 'file';

  export const NEW_FILE: Command = {
    id: 'file.new',
    category: CATEGORY,
    label: '%file.new%',
    iconClass: getIcon('new-file'),
  };

  export const RENAME_FILE: Command = {
    id: 'file.rename',
    category: CATEGORY,
    label: '%file.rename%',
  };

  export const DELETE_FILE: Command = {
    id: 'file.delete',
    category: CATEGORY,
    label: '%file.delete%',
  };

  export const NEW_FOLDER: Command = {
    id: 'file.folder.new',
    category: CATEGORY,
    label: '%file.folder.new%',
    iconClass: getIcon('new-folder'),
  };

  export const COMPARE_SELECTED: Command = {
    id: 'file.compare',
    category: CATEGORY,
    label: '%file.compare%',
  };

  export const OPEN_FILE: Command = {
    id: 'file.open',
    category: CATEGORY,
  };

  export const SAVE_FILE: Command = {
    id: 'file.save',
    category: CATEGORY,
  };

  export const COLLAPSE_ALL: Command = {
    id: 'filetree.collapse.all',
    category: CATEGORY,
    label: '%file.collapse%',
    iconClass: getIcon('collapse-all'),
  };

  export const REFRESH_ALL: Command = {
    id: 'filetree.refresh.all',
    category: CATEGORY,
    label: '%file.refresh%',
    iconClass: getIcon('refresh'),
  };

  export const OPEN_RESOURCES: Command = {
    id: 'filetree.open.file',
    category: CATEGORY,
    label: '%file.open%',
  };

  export const OPEN_TO_THE_SIDE: Command = {
    id: 'filetree.open.side',
    category: CATEGORY,
    label: '%file.open.side%',
  };

  export const COPY_PATH: Command = {
    id: 'filetree.copy.path',
    category: CATEGORY,
    label: '%file.copy.path%',
  };

  export const COPY_RELATIVE_PATH: Command = {
    id: 'filetree.copy.relativepath',
    category: CATEGORY,
    label: '%file.copy.relativepath%',
  };

  export const COPY_FILE: Command = {
    id: 'filetree.copy.file',
    category: CATEGORY,
    label: '%file.copy.file%',
  };

  export const CUT_FILE: Command = {
    id: 'filetree.cut.file',
    category: CATEGORY,
    label: '%file.cut.file%',
  };

  export const PASTE_FILE: Command = {
    id: 'filetree.paste.file',
    category: CATEGORY,
    label: '%file.paste.file%',
  };

  export const LOCATION: Command = {
    id: 'filetree.location',
    category: CATEGORY,
    label: '%file.location%',
  };

  export const OPEN_FOLDER: Command = {
    id: 'filetree.open.folder',
    category: CATEGORY,
    label: '%file.open.folder%',
  };

  export const SEARCH_ON_FOLDER: Command = {
    id: 'filetree.search.folder',
    category: CATEGORY,
    label: '%file.search.folder%',
  };

  export const FOCUS_FILES: Command = {
    id: 'filetree.focus.files',
    category: CATEGORY,
    label: '%file.focus.files%',
  };
}

export namespace OPEN_EDITORS_COMMANDS {
  const CATEGORY = 'openeditors';

  export const SAVE_ALL: Command = {
    id: 'open.editors.save.all',
    category: CATEGORY,
    label: '%open.editors.save.all%',
    iconClass: getIcon('save-all'),
  };

  export const CLOSE_ALL: Command = {
    id: 'open.editors.close.all',
    category: CATEGORY,
    label: '%open.editors.close.all%',
    iconClass: getIcon('close-all'),
  };

  export const SAVE_BY_GROUP_ID: Command = {
    id: 'open.editors.save.byID',
    label: '%open.editors.save.byID%',
  };

  export const CLOSE_BY_GROUP_ID: Command = {
    id: 'open.editors.close.byID',
    label: '%open.editors.close.byID%',
  };

  export const OPEN: Command = {
    id: 'open.editors.open',
    category: CATEGORY,
    label: '%open.editors.open%',
  };

  export const OPEN_TO_THE_SIDE: Command = {
    id: 'open.editors.openToTheSide',
    category: CATEGORY,
    label: '%open.editors.openToTheSide%',
  };

  export const COMPARE_SELECTED: Command = {
    id: 'open.editors.compare',
    category: CATEGORY,
    label: '%open.editors.compare%',
  };

  export const COPY_RELATIVE_PATH: Command = {
    id: 'open.editors.copyRelativePath',
    category: CATEGORY,
    label: '%open.editors.copyRelativePath%',
  };

  export const COPY_PATH: Command = {
    id: 'open.editors.copyPath',
    category: CATEGORY,
    label: '%open.editors.copyPath%',
  };
}

export namespace COMMON_COMMANDS {

  export const FIND: Command = {
    id: 'core.find',
    label: localize('common.find'),
  };

  export const REPLACE: Command = {
    id: 'core.replace',
    label: localize('common.replace'),
  };

  export const ABOUT_COMMAND: Command = {
    id: 'core.about',
    label: localize('common.about'),
  };

  export const OPEN_PREFERENCES: Command = {
    id: 'core.openpreference',
    label: '%common.preference.open%',
  };

  export const OPEN_KEYMAPS: Command = {
    id: 'core.keymaps.open',
    label: '%common.keymaps.open%',
  };
}

export namespace EDITOR_COMMANDS {
  const CATEGORY = 'editor';

  export const NEW_UNTITLED_FILE: Command = {
    id: 'file.new.untitled',
    category: CATEGORY,
    label: '%file.new%',
    iconClass: getIcon('new-file'),
  };

  export const UNDO: Command = {
    id: 'editor.undo',
    category: CATEGORY,
    label: '%editor.undo%',
  };
  export const REDO: Command = {
    id: 'editor.redo',
    category: CATEGORY,
    label: '%editor.redo%',
  };

  export const OPEN_RESOURCE: Command = {
    id: 'editor.openUri',
    category: CATEGORY,
  };

  export const OPEN_RESOURCES: Command = {
    id: 'editor.openUris',
    category: CATEGORY,
  };

  export const SAVE_URI: Command = {
    id: 'editor.saveUri',
    category: CATEGORY,
    label: '%editor.saveUri%',
  };

  export const SAVE_CURRENT: Command = {
    id: 'editor.saveCurrent',
    category: CATEGORY,
    label: '%editor.saveCurrent%',
  };

  export const COMPARE: Command = {
    id: 'editor.compare',
    category: CATEGORY,
  };

  export const CLOSE: Command = {
    id: 'editor.close',
    category: CATEGORY,
    label: '%editor.closeCurrent%',
  };

  export const CLOSE_ALL_IN_GROUP: Command = {
    id: 'editor.closeAllInGroup',
    category: CATEGORY,
    label: '%editor.closeAllInGroup%',
  };

  export const CLOSE_OTHER_IN_GROUP: Command = {
    id: 'editor.closeOtherEditorsInGroup',
    category: CATEGORY,
    label: '%editor.closeOtherEditors%',
  };

  export const CLOSE_ALL: Command = {
    id: 'editor.closeAll',
    category: CATEGORY,
    label: '%editor.close.all%',
  };

  export const CLOSE_SAVED: Command = {
    id: 'editor.closeSaved',
    category: CATEGORY,
    label: '%editor.closeSaved%',
  };

  export const SAVE_ALL: Command = {
    id: 'editor.saveAll',
    category: CATEGORY,
    label: '%editor.saveAll%',
  };

  export const CLOSE_TO_RIGHT: Command = {
    id: 'editor.closeToRight',
    category: CATEGORY,
    label: '%editor.closeToRight%',
  };

  export const GET_CURRENT: Command = {
    id: 'editor.getCurrent',
    category: CATEGORY,
  };

  export const SPLIT_TO_LEFT: Command = {
    id: 'editor.splitToLeft',
    category: CATEGORY,
    label: '%editor.splitToLeft%',
  };

  export const SPLIT_TO_RIGHT: Command = {
    id: 'editor.splitToRight',
    category: CATEGORY,
    label: '%editor.splitToRight%',
  };

  export const SPLIT_TO_TOP: Command = {
    id: 'editor.splitToTop',
    category: CATEGORY,
    label: '%editor.splitToTop%',
  };

  export const SPLIT_TO_BOTTOM: Command = {
    id: 'editor.splitToBottom',
    category: CATEGORY,
    label: '%editor.splitToBottom%',
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

  export const NAVIGATE_PREVIOUS: Command = {
    id: 'editor.navigatePrevious',
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
    label: '%closeEditorsInOtherGroups%',
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

  export const GO_FORWARD: Command = {
    id: 'editor.goForward',
    category: CATEGORY,
  };

  export const GO_BACK: Command = {
    id: 'editor.goBack',
    category: CATEGORY,
  };

  export const PIN_CURRENT: Command = {
    id: 'editor.pinCurrent',
    category: CATEGORY,
  };

  export const COPY_CURRENT_PATH: Command = {
    id: 'editor.copyCurrentPath',
    category: CATEGORY,
  };

  export const GO_TO_GROUP: Command = {
    id: 'editor.goToGroup',
    category: CATEGORY,
  };

  export const MOVE_GROUP: Command = {
    id: 'editor.moveGroup',
    category: CATEGORY,
  };

  export const REOPEN_CLOSED: Command = {
    id: 'editor.reopenClosed',
    category: CATEGORY,
  };

  export const FOCUS: Command = {
    id: 'editor.focus',
    category: CATEGORY,
  };

  export const TEST_TOKENIZE: Command = {
    id: 'editor.tokenize.test',
    category: CATEGORY,
    label: '%editor.tokenize.test%',
  };
}

export namespace SEARCH_COMMANDS {
  const CATEGORY = 'search';

  export const OPEN_SEARCH: Command = {
    id: 'content-search.openSearch',
    category: CATEGORY,
    label: 'Open search sidebar',
  };

  export const REFRESH: Command = {
    id: 'file-search.refresh',
    label: 'refresh search',
    iconClass: getIcon('refresh'),
    category: CATEGORY,
  };

  export const CLEAN: Command = {
    id: 'file-search.clean',
    label: 'clean search',
    iconClass: getIcon('clear'),
    category: CATEGORY,
  };

  export const FOLD: Command = {
    id: 'file-search.fold',
    label: 'fold search',
    iconClass: getIcon('fold'),
    category: CATEGORY,
  };

  export const GET_RECENT_SEARCH_WORD: Command = {
    id: 'search.getRecentSearchWordCmd',
    category: CATEGORY,
  };

  export const GET_BACK_RECENT_SEARCH_WORD: Command = {
    id: 'search.getBackRecentSearchWordCmd',
    category: CATEGORY,
  };

  export const MENU_REPLACE: Command = {
    id: 'search.menu.replace',
    category: CATEGORY,
    label: '%search.replace.title%',
  };

  export const MENU_REPLACE_ALL: Command = {
    id: 'search.menu.replaceAll',
    category: CATEGORY,
    label: '%search.replaceAll.label%',
  };

  export const MENU_HIDE: Command = {
    id: 'search.menu.hide',
    category: CATEGORY,
    label: '%search.result.hide%',
  };

  export const MENU_COPY: Command = {
    id: 'search.menu.copy',
    category: CATEGORY,
    label: '%file.copy.file%',
  };

  export const MENU_COPY_ALL: Command = {
    id: 'search.menu.copyAll',
    category: CATEGORY,
    label: '%search.menu.copyAll%',
  };

  export const MENU_COPY_PATH: Command = {
    id: 'search.menu.copyPath',
    category: CATEGORY,
    label: '%file.copy.path%',
  };
}
