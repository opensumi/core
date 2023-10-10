/**
 * If you want to do localization, please use the placeholder `%%` instead of use `localize` function.
 * because the `localize` func maybe cannot get the correct languageId at the beginning of whole lifecycle.
 */

import { Command } from '@opensumi/ide-core-common';

import { getIcon } from '../style/icon/icon';

export namespace FILE_COMMANDS {
  const CATEGORY = 'file';

  export const NEW_FILE: Command = {
    id: 'file.new',
    category: CATEGORY,
    iconClass: getIcon('new-file'),
  };

  export const RENAME_FILE: Command = {
    id: 'file.rename',
    category: CATEGORY,
  };

  export const DELETE_FILE: Command = {
    id: 'file.delete',
    category: CATEGORY,
  };

  export const NEW_FOLDER: Command = {
    id: 'file.folder.new',
    category: CATEGORY,
    iconClass: getIcon('new-folder'),
  };

  export const COMPARE_SELECTED: Command = {
    id: 'file.compare',
    category: CATEGORY,
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
    iconClass: getIcon('collapse-all'),
  };

  export const REFRESH_ALL: Command = {
    id: 'filetree.refresh.all',
    category: CATEGORY,
    iconClass: getIcon('refresh'),
  };

  export const OPEN_RESOURCES: Command = {
    id: 'filetree.open.file',
    category: CATEGORY,
  };

  export const OPEN_TO_THE_SIDE: Command = {
    id: 'filetree.open.side',
    category: CATEGORY,
  };

  export const OPEN_TYPE_WITH: Command = {
    id: 'filetree.open.with',
    category: CATEGORY,
  };

  export const COPY_PATH: Command = {
    id: 'filetree.copy.path',
    category: CATEGORY,
    label: '%file.copy.path%',
  };

  export const COPY_RELATIVE_PATH: Command = {
    id: 'filetree.copy.relativepath',
    category: CATEGORY,
  };

  export const COPY_FILE: Command = {
    id: 'filetree.copy.file',
    category: CATEGORY,
  };

  export const CUT_FILE: Command = {
    id: 'filetree.cut.file',
    category: CATEGORY,
  };

  export const PASTE_FILE: Command = {
    id: 'filetree.paste.file',
    category: CATEGORY,
  };

  export const SELECT_CURRENT_NODE: Command = {
    id: 'filetree.selectCurrentNode',
    category: CATEGORY,
  };

  export const LOCATION: Command = {
    id: 'filetree.location',
    category: CATEGORY,
  };

  export const LOCATION_WITH_EDITOR: Command = {
    id: 'filetree.location_with_editor',
    category: CATEGORY,
    iconClass: getIcon('focus'),
  };

  export const OPEN_FOLDER: Command = {
    id: 'filetree.open.folder',
    category: CATEGORY,
    label: '%file.open.folder%',
  };

  export const VSCODE_OPEN_FOLDER: Command = {
    id: 'filetree.open.vscode_open_folder',
    category: CATEGORY,
  };

  export const OPEN_WORKSPACE: Command = {
    id: 'filetree.open.workspace',
    category: CATEGORY,
    label: '%file.open.workspace%',
  };

  export const SEARCH_ON_FOLDER: Command = {
    id: 'filetree.search.folder',
    category: CATEGORY,
  };

  export const FOCUS_FILES: Command = {
    id: 'filetree.focus.files',
    category: CATEGORY,
    label: '%file.focus.files%',
  };

  export const FILTER_TOGGLE: Command = {
    id: 'filetree.files.filter_toggle',
    category: CATEGORY,
    iconClass: getIcon('retrieval'),
  };

  export const FILTER_OPEN: Command = {
    id: 'filetree.files.filter_open',
    category: CATEGORY,
  };

  export const OPEN_TERMINAL_WITH_PATH: Command = {
    id: 'filetree.openTerminalWithPath',
    category: CATEGORY,
  };

  export const FILTER_CLOSE: Command = {
    id: 'filetree.quitFilterMode',
    category: CATEGORY,
  };

  export const NEXT: Command = {
    id: 'filetree.next',
    category: CATEGORY,
  };

  export const PREV: Command = {
    id: 'filetree.prev',
    category: CATEGORY,
  };

  export const COLLAPSE: Command = {
    id: 'filetree.collapse',
    category: CATEGORY,
  };

  export const EXPAND: Command = {
    id: 'filetree.expand',
    category: CATEGORY,
  };

  export const REVEAL_IN_EXPLORER: Command = {
    id: 'filetree.revealInExplorer',
    category: CATEGORY,
  };

  export const TOGGLE_OR_OPEN: Command = {
    id: 'filetree.toggleOrOpen',
    category: CATEGORY,
  };
}

export namespace OPEN_EDITORS_COMMANDS {
  const CATEGORY = 'openeditors';

  export const SAVE_ALL: Command = {
    id: 'opened.editors.save.all',
    category: CATEGORY,
    iconClass: getIcon('save-all'),
  };

  export const CLOSE_ALL: Command = {
    id: 'opened.editors.close.all',
    category: CATEGORY,
    iconClass: getIcon('close-all'),
  };

  export const SAVE_BY_GROUP: Command = {
    id: 'opened.editors.save.byGroup',
  };

  export const CLOSE_BY_GROUP: Command = {
    id: 'opened.editors.close.byGroup',
  };

  export const OPEN: Command = {
    id: 'opened.editors.open',
    category: CATEGORY,
  };

  export const CLOSE: Command = {
    id: 'opened.editors.close',
    category: CATEGORY,
  };

  export const OPEN_TO_THE_SIDE: Command = {
    id: 'opened.editors.openToTheSide',
    category: CATEGORY,
  };

  export const COMPARE_SELECTED: Command = {
    id: 'opened.editors.compare',
    category: CATEGORY,
  };

  export const COPY_RELATIVE_PATH: Command = {
    id: 'opened.editors.copyRelativePath',
    category: CATEGORY,
  };

  export const COPY_PATH: Command = {
    id: 'opened.editors.copyPath',
    category: CATEGORY,
  };

  export const LOCATION: Command = {
    id: 'opened.editors.location',
    category: CATEGORY,
  };
}

export namespace COMMON_COMMANDS {
  export const FIND: Command = {
    id: 'core.find',
    label: '%common.find%',
  };

  export const REPLACE: Command = {
    id: 'core.replace',
    label: '%common.replace%',
  };

  export const ABOUT_COMMAND: Command = {
    id: 'core.about',
    label: '%common.about%',
  };

  export const OPEN_PREFERENCES: Command = {
    id: 'core.openpreference',
    label: '%common.preference.open%',
  };

  export const LOCATE_PREFERENCES: Command = {
    id: 'workbench.preferences.locate',
  };

  export const OPEN_KEYMAPS: Command = {
    id: 'core.keymaps.open',
    label: '%common.keymaps.open%',
  };

  export const OPEN_LAUNCH_CONFIGURATION: Command = {
    id: 'core.launchConfiguration.open',
    label: '%debug.action.open.configuration%',
  };

  export const ENVIRONMENT_VARIABLE: Command = {
    id: 'core.environment.variable',
  };
}

export namespace EDITOR_COMMANDS {
  const CATEGORY = 'editor';

  export const API_OPEN_EDITOR_COMMAND_ID = '_workbench.open';
  export const API_OPEN_DIFF_EDITOR_COMMAND_ID = '_workbench.diff';
  export const API_OPEN_WITH_EDITOR_COMMAND_ID = '_workbench.openWith';

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

  export const SELECT_ALL: Command = {
    id: 'editor.selectAll',
    category: CATEGORY,
    label: '%selection.all%',
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
  };

  export const SAVE_CURRENT: Command = {
    id: 'editor.saveCurrent',
    category: CATEGORY,
    label: '%editor.saveCurrent%',
  };

  export const FOCUS_IF_NOT_ACTIVATE_ELEMENT: Command = {
    id: 'editor.focusIfNotActivateElement',
    category: CATEGORY,
    label: '%editor.saveCurrent%',
  };

  export const COMPARE: Command = {
    id: 'editor.compare',
    category: CATEGORY,
  };

  export const OPEN_MERGEEDITOR: Command = {
    id: 'editor.open.mergeEditor',
    category: CATEGORY,
  };

  export const MERGEEDITOR_RESET: Command = {
    id: 'editor.mergeEditor.reset',
    category: CATEGORY,
    label: '%mergeEditor.reset%',
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

  export const GET_CURRENT_RESOURCE: Command = {
    id: 'editor.getCurrentResource',
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
    iconClass: getIcon('embed'),
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
    label: '%editor.closeEditorsInOtherGroups%',
  };

  export const OPEN_EDITOR_AT_INDEX: Command = {
    id: 'editor.openEditorAtIndex',
    category: CATEGORY,
  };

  export const EVEN_EDITOR_GROUPS: Command = {
    id: 'editor.evenEditorGroups',
    category: CATEGORY,
    label: '%editor.resetEditorGroups%',
  };

  export const REVERT_DOCUMENT: Command = {
    id: 'editor.document.revert',
    category: CATEGORY,
    label: '%editor.revert%',
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

  export const AUTO_SAVE: Command = {
    id: 'editor.autoSave',
    category: CATEGORY,
  };

  export const FOCUS_ACTIVE_EDITOR_GROUP: Command = {
    id: 'editor.focusActiveEditorGroup',
    category: CATEGORY,
  };

  /**
   * 编辑器是富组件时的 undo
   */
  export const COMPONENT_UNDO: Command = {
    id: 'editor.componentUndo',
    category: CATEGORY,
  };

  /**
   * 编辑器是富组件时的 redo
   */
  export const COMPONENT_REDO: Command = {
    id: 'editor.componentRedo',
  };

  export const SEARCH_WORKSPACE_SYMBOL: Command = {
    id: 'editor.workspaceSymbol.quickopen',
    label: '%editor.workspaceSymbol.quickopen%',
    category: CATEGORY,
  };

  export const SEARCH_WORKSPACE_SYMBOL_CLASS: Command = {
    id: 'editor.workspaceSymbolClass.quickopen',
    label: '%editor.workspaceSymbolClass.quickopen%',
    category: CATEGORY,
  };

  export const GO_TO_LINE: Command = {
    id: 'editor.action.gotoLine',
    label: '%editor.goToLine%',
    category: CATEGORY,
  };

  export const QUICK_OPEN: Command = {
    id: 'workbench.action.quickOpen',
    category: CATEGORY,
    label: '%editor.quickOpen%',
  };

  export const TOGGLE_WORD_WRAP: Command = {
    id: 'editor.toggleWordWrap',
    label: '%editor.toggleWordWrap%',
    category: CATEGORY,
  };

  export const FORMAT_DOCUMENT_WITH: Command = {
    id: 'editor.action.formatDocument.multiple',
    category: CATEGORY,
    label: '%editor.formatDocument.label.multiple%',
  };

  export const FORMAT_SELECTION_WITH: Command = {
    id: 'editor.action.formatSelection.multiple',
    category: CATEGORY,
    label: '%editor.formatSelection.label.multiple%',
  };

  export const COPY_PATH: Command = {
    id: 'editor.action.copyPath',
    category: CATEGORY,
    label: '%editor.copyPath%',
  };

  export const COPY_RELATIVE_PATH: Command = {
    id: 'editor.action.copyRelativePath',
    category: CATEGORY,
    label: '%editor.copyRelativePath%',
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

  export const REPLACE: Command = {
    id: 'search.replace',
    category: CATEGORY,
  };

  export const CLOSE: Command = {
    id: 'search.close',
    category: CATEGORY,
  };
}

export namespace OUTLINE_COMMANDS {
  const CATEGORY = 'outline';

  export const OUTLINE_COLLAPSE_ALL: Command = {
    id: 'outline.collapse.all',
    category: CATEGORY,
  };

  export const OUTLINE_FOLLOW_CURSOR: Command = {
    id: 'outline.follow.cursor',
    category: CATEGORY,
  };

  export const OUTLINE_SORT_KIND: Command = {
    id: 'outline.sort.kind',
    category: CATEGORY,
  };

  export const OUTLINE_SORT_NAME: Command = {
    id: 'outline.sort.name',
    category: CATEGORY,
  };

  export const OUTLINE_SORT_POSITION: Command = {
    id: 'outline.sort.position',
    category: CATEGORY,
  };
}

export namespace WORKSPACE_COMMANDS {
  const CATEGORY = 'workspace';

  export const ADD_WORKSPACE_FOLDER: Command = {
    id: 'workspace.addFolderToWorkspace',
    label: '%workspace.addFolderToWorkspace%',
    category: CATEGORY,
  };

  export const REMOVE_WORKSPACE_FOLDER: Command = {
    id: 'workspace.removeFolderFromWorkspace',
    category: CATEGORY,
  };

  export const SAVE_WORKSPACE_AS_FILE: Command = {
    id: 'workspace.saveWorkspaceAsFile',
    label: '%workspace.saveWorkspaceAsFile%',
    category: CATEGORY,
  };
}

export namespace KEYBOARD_COMMANDS {
  const CATEGORY = 'keyboard';

  export const CHOOSE_KEYBOARD_LAYOUT: Command = {
    id: 'keyboard.chooseKeyboardLayout',
    label: '%keyboard.chooseKeyboardLayout%',
    category: CATEGORY,
  };
}

export namespace DIALOG_COMMANDS {
  const CATEGORY = 'dialog';

  export const ENSURE: Command = {
    id: 'dialog.ensure',
    category: CATEGORY,
  };
}

export namespace TERMINAL_COMMANDS {
  const CATEGORY = '%terminal.name%';

  export const FOCUS_NEXT_TERMINAL = {
    id: 'workbench.action.terminal.focusNextPane',
    label: '%terminal.focusNext.inTerminalGroup%',
    category: CATEGORY,
  };

  export const FOCUS_PREVIOUS_TERMINAL = {
    id: 'workbench.action.terminal.focusPreviousPane',
    label: '%terminal.focusPrevious.inTerminalGroup%',
    category: CATEGORY,
  };

  export const SPLIT = {
    id: 'terminal.split',
    label: '%terminal.split%',
    category: CATEGORY,
  };

  export const ADD = {
    id: 'terminal.add',
    label: '%terminal.new%',
    category: CATEGORY,
  };

  export const REMOVE = {
    id: 'terminal.remove',
    label: '%terminal.remove%',
    category: CATEGORY,
  };

  export const CLEAR = {
    id: 'terminal.clear',
    label: '%terminal.clear%',
    category: CATEGORY,
  };

  export const OPEN_SEARCH = {
    id: 'terminal.search',
    label: '%terminal.search%',
    category: CATEGORY,
  };

  export const SEARCH_NEXT = {
    id: 'terminal.search.next',
    label: '%terminal.search.next%',
    category: CATEGORY,
  };

  export const OPEN_WITH_PATH = {
    id: 'terminal.openWithPath',
    category: CATEGORY,
  };

  export const CLEAR_CONTENT = {
    id: 'terminal.clearContent',
    label: '%terminal.menu.clearCurrentContent%',
    category: CATEGORY,
  };

  export const CLEAR_ALL_CONTENT = {
    id: 'terminal.clearAllContent',
    label: '%terminal.menu.clearAllContents%',
    category: CATEGORY,
  };

  export const TAB_RENAME = {
    id: 'terminal.tabRename',
    category: CATEGORY,
  };

  export const SELECT_ALL_CONTENT = {
    id: 'terminal.selectAllContent',
    label: '%terminal.menu.selectAllContent%',
    category: CATEGORY,
  };

  export const MORE_SETTINGS = {
    id: 'terminal.moreSettings',
    label: '%terminal.menu.moreSettings%',
    category: CATEGORY,
  };

  export const SELECT_TYPE = {
    id: 'terminal.selectType',
    category: CATEGORY,
  };

  export const SELECT_ZSH = {
    id: 'terminal.selectTypeZsh',
    label: 'zsh',
    category: CATEGORY,
  };

  export const SELECT_BASH = {
    id: 'terminal.selectTypeBash',
    label: 'bash',
    category: CATEGORY,
  };

  export const SELECT_SH = {
    id: 'terminal.selectTypeSh',
    label: 'sh',
    category: CATEGORY,
  };

  export const SELECT_CMD = {
    id: 'terminal.selectTypeCMD',
    label: 'cmd',
    category: CATEGORY,
  };

  export const SELECT_POWERSHELL = {
    id: 'terminal.selectTypePowerShell',
    label: 'powershell',
    category: CATEGORY,
  };

  export const COPY = {
    id: 'terminal.copy',
    label: '%edit.copy%',
    category: CATEGORY,
  };

  export const PASTE = {
    id: 'terminal.paste',
    label: '%edit.paste%',
    category: CATEGORY,
  };

  export const SELECT_ALL = {
    id: 'terminal.selectAll',
    label: '%terminal.menu.selectCurrentContent%',
    category: CATEGORY,
  };

  export const RE_LAUNCH = {
    id: 'terminal.relaunch',
    category: CATEGORY,
  };

  export const TOGGLE_TERMINAL = {
    id: 'terminal.toggleTerminal',
    label: '%terminal.toggleTerminal%',
    category: CATEGORY,
  };

  export const KILL_PROCESS = {
    id: 'terminal.killProcess',
    label: '%terminal.killProcess%',
    category: CATEGORY,
  };
}

export namespace LAYOUT_COMMANDS {
  const CATEGORY = 'view';

  export const QUICK_OPEN_VIEW: Command = {
    id: 'layout.action.quickOpenView',
    category: CATEGORY,
  };

  export const OPEN_VIEW = {
    id: 'layout.action.openView',
    label: '%layout.action.openView%',
    category: CATEGORY,
  };

  export const MAXIMIZE_EDITOR = {
    id: 'layout.action.Maximizeeditor',
    category: CATEGORY,
  };
  export const TOGGLE_SIDEBAR_VISIBILITY = {
    id: 'main-layout.left-panel.toggle',
    category: CATEGORY,
  };
}

export namespace MARKER_COMMANDS {
  const CATEGORY = 'marker';

  export const SHOW_ERRORS_WARNINGS = {
    id: 'marker.action.showErrorsWarnings',
    category: CATEGORY,
  };

  export const TOGGLE_SHOW_ERRORS_WARNINGS = {
    id: 'marker.action.toggleShowErrorsWarnings',
    category: CATEGORY,
  };
}

export namespace QUICK_OPEN_COMMANDS {
  export const OPEN: Command = {
    id: 'editor.action.quickCommand',
  };
  export const OPEN_OUTLINE: Command = {
    id: 'editor.action.quickOutline',
  };
  export const OPEN_VIEW: Command = {
    id: 'editor.action.quickView',
  };
}

export namespace SCM_COMMANDS {
  // git extension 1.71 版本之前存在下划线，这里为了做兼容处理: https://github.com/microsoft/vscode/blob/1.68.1/extensions/git/src/repository.ts#L613
  export const _GIT_OPEN_MERGE_EDITOR: Command = {
    id: '_git.openMergeEditor',
  };
  // git extension 1.71 版本之后就去掉了前面的下划线: https://github.com/microsoft/vscode/commit/c0ade8bc816386b7194d69fed878d4b9bb796d6c#diff-da56ff967ab1a9606c01af61dc926332afb862f13c8e5c74a575bc2aa1b15e43R411
  export const GIT_OPEN_MERGE_EDITOR: Command = {
    id: 'git.openMergeEditor',
  };
}
