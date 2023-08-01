import {
  FILE_COMMANDS,
  Command,
  EDITOR_COMMANDS,
  COMMON_COMMANDS,
  TERMINAL_COMMANDS,
  MARKER_COMMANDS,
  SEARCH_COMMANDS,
  LAYOUT_COMMANDS,
} from '@opensumi/ide-core-browser';
import { DEBUG_COMMANDS } from '@opensumi/ide-debug';
import { THEME_TOGGLE_COMMAND } from '@opensumi/ide-theme/lib/browser/theme.contribution';

/**
 * 插件进程内置 command 的命名空间
 */
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
  delegate: EDITOR_COMMANDS.NEW_UNTITLED_FILE.id,
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
  delegate: EDITOR_COMMANDS.CLOSE_OTHER_GROUPS.id,
};

export const CLOSE_UNMODIFIED_EDITORS: Command = {
  id: 'workbench.action.closeUnmodifiedEditors',
  delegate: EDITOR_COMMANDS.CLOSE_SAVED.id,
};

export const OPEN_EDITOR_AT_INDEX: Command = {
  id: 'workbench.action.openEditorAtIndex',
  delegate: EDITOR_COMMANDS.OPEN_EDITOR_AT_INDEX.id,
};

export const REVERT_FILES: Command = {
  id: 'workbench.action.files.revert',
  delegate: EDITOR_COMMANDS.REVERT_DOCUMENT.id,
};

export const TERMINAL_COMMAND_FOCUS: Command = {
  id: 'workbench.action.terminal.focus',
  delegate: 'workbench.view.terminal',
};

export const TERMINAL_COMMAND_TOGGLE_VISIBILITY: Command = {
  id: 'workbench.action.terminal.toggleTerminal',
  // 每一个 Container 在注册后都会注册自己的 toggle 命令
  delegate: 'container.toggle.terminal',
};

export const NEW_WORKBENCH_VIEW_TERMINAL: Command = {
  id: 'workbench.action.terminal.new',
  delegate: TERMINAL_COMMANDS.ADD.id,
};

// 在资源管理器中聚焦文件
export const WORKBENCH_FOCUS_FILES_EXPLORER: Command = {
  id: 'workbench.files.action.focusFilesExplorer',
  delegate: FILE_COMMANDS.FOCUS_FILES.id,
};

export const FILE_COMMAND_RENAME_FILE: Command = {
  id: 'renameFile',
  delegate: FILE_COMMANDS.RENAME_FILE.id,
};

// 打开激活的编辑器组
export const WORKBENCH_FOCUS_ACTIVE_EDITOR_GROUP: Command = {
  id: 'workbench.action.focusActiveEditorGroup',
  delegate: EDITOR_COMMANDS.FOCUS_ACTIVE_EDITOR_GROUP.id,
};

// 打开内容
export const OPEN: Command = {
  id: 'vscode.open',
};

export const API_OPEN_EDITOR_COMMAND_ID: Command = {
  id: EDITOR_COMMANDS.API_OPEN_EDITOR_COMMAND_ID,
  delegate: OPEN.id,
};

// 打开文件夹
export const OPEN_FOLDER: Command = {
  id: 'vscode.openFolder',
  delegate: FILE_COMMANDS.VSCODE_OPEN_FOLDER.id,
};

// 比较内容
export const DIFF: Command = {
  id: 'vscode.diff',
};

export const OPEN_WITH: Command = {
  id: 'vscode.openWith',
};

export const API_OPEN_DIFF_EDITOR_COMMAND_ID: Command = {
  id: EDITOR_COMMANDS.API_OPEN_DIFF_EDITOR_COMMAND_ID,
  delegate: DIFF.id,
};

export const API_OPEN_WITH_EDITOR_COMMAND_ID: Command = {
  id: EDITOR_COMMANDS.API_OPEN_WITH_EDITOR_COMMAND_ID,
  delegate: OPEN_WITH.id,
};

export const RELOAD_WINDOW_COMMAND: Command = {
  id: 'reload_window',
};

export const RELOAD_WINDOW: Command = {
  id: 'workbench.action.reloadWindow',
  delegate: RELOAD_WINDOW_COMMAND.id,
};

export const SHOW_RUN_TIME_EXTENSION: Command = {
  id: 'workbench.action.showRuntimeExtensions',
  label: 'Show Running Extensions',
};

export const START_EXTENSION_HOST_PROFILER: Command = {
  id: 'workbench.action.extensionHostProfiler.start',
  label: 'Start Extension Host Profile',
};

export const STOP_EXTENSION_HOST_PROFILER: Command = {
  id: 'workbench.action.extensionHostProfiler.stop',
  label: 'Stop Extension Host Profile',
};

export const CLEAR_TERMINAL: Command = {
  id: 'workbench.action.terminal.clear',
  delegate: TERMINAL_COMMANDS.CLEAR_CONTENT.id,
};

export const COPY_FILE_PATH: Command = {
  id: 'copyFilePath',
  label: FILE_COMMANDS.COPY_PATH.label,
};

export const COPY_RELATIVE_FILE_PATH: Command = {
  id: 'copyRelativeFilePath',
  label: FILE_COMMANDS.COPY_RELATIVE_PATH.label,
};

export const SETTINGS_COMMAND_OPEN_SETTINGS: Command = {
  id: 'workbench.action.openSettings',
  delegate: 'core.openpreference',
};

export const SETTINGS_COMMAND_OPEN_GLOBAL_SETTINGS: Command = {
  id: 'workbench.action.openGlobalSettings',
  delegate: COMMON_COMMANDS.OPEN_PREFERENCES.id,
};

export const SETTINGS_COMMAND_OPEN_SETTINGS_JSON: Command = {
  id: 'workbench.action.openSettingsJson',
  delegate: 'preference.open.source',
};

export const SETTINGS_COMMAND_OPEN_GLOBAL_OPEN_KEYMAPS: Command = {
  id: 'workbench.action.openGlobalKeybindings',
  delegate: COMMON_COMMANDS.OPEN_KEYMAPS.id,
};

export const EDITOR_NAVIGATE_BACK: Command = {
  id: 'workbench.action.navigateBack',
  delegate: EDITOR_COMMANDS.GO_BACK.id,
};

export const EDITOR_NAVIGATE_FORWARD: Command = {
  id: 'workbench.action.navigateForward',
  delegate: EDITOR_COMMANDS.GO_FORWARD.id,
};

export const EDITOR_SAVE_ALL: Command = {
  id: 'workbench.action.files.saveAll',
  delegate: EDITOR_COMMANDS.SAVE_ALL.id,
};

export const DEBUG_COMMAND_STEP_INTO: Command = {
  id: 'workbench.action.debug.stepInto',
  delegate: DEBUG_COMMANDS.NEXT.id,
};

export const DEBUG_COMMAND_STEP_OVER: Command = {
  id: 'workbench.action.debug.stepOver',
  delegate: DEBUG_COMMANDS.OVER.id,
};

export const DEBUG_COMMAND_STEP_OUT: Command = {
  id: 'workbench.action.debug.stepOut',
  delegate: DEBUG_COMMANDS.PREV.id,
};

export const DEBUG_COMMAND_CONTINUE: Command = {
  id: 'workbench.action.debug.continue',
  delegate: DEBUG_COMMANDS.CONTINUE.id,
};

export const DEBUG_COMMAND_RUN: Command = {
  id: 'workbench.action.debug.run',
  delegate: DEBUG_COMMANDS.START.id,
};

export const DEBUG_COMMAND_START: Command = {
  id: 'workbench.action.debug.start',
  delegate: DEBUG_COMMANDS.START.id,
};

export const DEBUG_COMMAND_PAUSE: Command = {
  id: 'workbench.action.debug.pause',
  delegate: DEBUG_COMMANDS.PAUSE.id,
};

export const DEBUG_COMMAND_RESTART: Command = {
  id: 'workbench.action.debug.restart',
  delegate: DEBUG_COMMANDS.RESTART.id,
};

export const DEBUG_COMMAND_STOP: Command = {
  id: 'workbench.action.debug.stop',
  delegate: DEBUG_COMMANDS.STOP.id,
};

export const EDITOR_SHOW_ALL_SYMBOLS: Command = {
  id: 'workbench.action.showAllSymbols',
  delegate: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL.id,
};

export const REVEAL_IN_EXPLORER: Command = {
  id: 'revealInExplorer',
  delegate: FILE_COMMANDS.REVEAL_IN_EXPLORER.id,
};

export const GET_EXTENSION: Command = {
  id: 'extension.getDescription',
};

export const MARKER_COMMAND_SHOW_ERRORS_WARNINGS: Command = {
  id: 'workbench.action.showErrorsWarnings',
  delegate: MARKER_COMMANDS.SHOW_ERRORS_WARNINGS.id,
};

export const MARKER_COMMAND_TOGGLE_SHOW_ERRORS_WARNINGS: Command = {
  id: 'workbench.actions.view.problems',
  delegate: MARKER_COMMANDS.TOGGLE_SHOW_ERRORS_WARNINGS.id,
};

export const SIDEBAR_TOGGLE_VISIBILITY: Command = {
  id: 'workbench.action.toggleSidebarVisibility',
  delegate: LAYOUT_COMMANDS.TOGGLE_SIDEBAR_VISIBILITY.id,
};

export const SEARCH_COMMAND_OPEN_SEARCH: Command = {
  id: 'workbench.action.findInFiles',
  delegate: SEARCH_COMMANDS.OPEN_SEARCH.id,
};

export const THEME_COMMAND_QUICK_SELECT: Command = {
  id: 'workbench.action.selectTheme',
  delegate: THEME_TOGGLE_COMMAND.id,
};

export const LAYOUT_COMMAND_MAXIMIZE_EDITOR: Command = {
  id: 'workbench.action.maximizeEditor',
  delegate: LAYOUT_COMMANDS.MAXIMIZE_EDITOR.id,
};

export const WALKTHROUGHS_COMMAND_GET_STARTED: Command = {
  id: 'walkthroughs.get.started',
};

export const OPEN_MERGEEDITOR: Command = {
  id: '_open.mergeEditor',
  delegate: EDITOR_COMMANDS.OPEN_MERGEEDITOR.id,
};
