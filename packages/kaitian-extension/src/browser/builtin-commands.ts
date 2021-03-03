import { TERMINAL_COMMANDS } from '@ali/ide-terminal-next';
import { FILE_COMMANDS, Command } from '@ali/ide-core-browser';
import { quickCommand } from '@ali/ide-quick-open';

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
  delegate: quickCommand.id,
};
