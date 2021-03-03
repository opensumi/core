import { TERMINAL_COMMANDS } from '@ali/ide-terminal-next';
import { FILE_COMMANDS, Command } from '@ali/ide-core-browser';
import { QUICK_OPEN_COMMANDS } from '@ali/ide-quick-open';
import { DEBUG_COMMANDS } from '@ali/ide-debug/lib/browser/debug-contribution';

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

export const QPEN_COMMAND_PALETTE: Command = {
  id: 'workbench.action.quickOpen',
  delegate: QUICK_OPEN_COMMANDS.OPEN.id,
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
