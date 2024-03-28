import { Command } from '@opensumi/ide-core-common';

export namespace DEBUG_COMMANDS {
  export const ADD_WATCHER: Command = {
    id: 'debug.watch.add',
  };
  export const COLLAPSE_ALL_WATCHER: Command = {
    id: 'debug.watch.collapseAll',
  };
  export const REMOVE_ALL_WATCHER: Command = {
    id: 'debug.watch.removeAll',
  };
  export const REMOVE_WATCHER: Command = {
    id: 'debug.watch.remove',
  };
  export const EDIT_WATCHER: Command = {
    id: 'debug.watch.edit',
  };
  export const COPY_WATCHER_VALUE: Command = {
    id: 'debug.watch.copyValue',
  };
  export const REMOVE_ALL_BREAKPOINTS: Command = {
    id: 'debug.breakpoints.remove.all',
  };
  export const TOGGLE_BREAKPOINTS: Command = {
    id: 'debug.breakpoints.toggle',
  };
  export const ACTIVE_BREAKPOINTS: Command = {
    id: 'debug.breakpoints.active',
  };
  export const DEACTIVE_BREAKPOINTS: Command = {
    id: 'debug.breakpoints.deactive',
  };
  export const START: Command = {
    id: 'debug.start',
  };
  export const NEXT: Command = {
    id: 'debug.next',
  };
  export const PREV: Command = {
    id: 'debug.prev',
  };
  export const OVER: Command = {
    id: 'debug.over',
  };
  export const STOP: Command = {
    id: 'debug.stop',
  };
  export const CONTINUE: Command = {
    id: 'debug.continue',
  };
  export const RESTART: Command = {
    id: 'debug.restart',
  };
  export const PAUSE: Command = {
    id: 'debug.pause',
  };
  // menu commands
  export const DELETE_BREAKPOINT: Command = {
    id: 'debug.delete.breakpoint',
    label: '%debug.menu.delete.breakpoint%',
  };
  export const EDIT_BREAKPOINT: Command = {
    id: 'debug.edit.breakpoint',
    label: '%debug.menu.edit.breakpoint%',
  };
  export const DISABLE_BREAKPOINT: Command = {
    id: 'debug.disable.breakpoint',
    label: '%debug.menu.disable.breakpoint%',
  };
  export const ENABLE_BREAKPOINT: Command = {
    id: 'debug.enable.breakpoint',
    label: '%debug.menu.enable.breakpoint%',
  };
  export const ENABLE_LOGPOINT: Command = {
    id: 'debug.enable.logpoint',
    label: '%debug.menu.enable.logpoint',
  };
  export const ADD_BREAKPOINT: Command = {
    id: 'debug.add.breakpoint',
    label: '%debug.menu.add.breakpoint%',
  };
  export const ADD_LOGPOINT: Command = {
    id: 'debug.add.logpoint',
    label: '%debug.menu.add.logpoint%',
  };
  export const ADD_CONDITIONAL_BREAKPOINT: Command = {
    id: 'debug.add.conditional',
    label: '%debug.menu.add.conditional%',
  };
  export const RESTART_FRAME: Command = {
    id: 'debug.callstack.restart.frame',
  };
  export const COPY_STACK_TRACE: Command = {
    id: 'debug.callstack.copy',
  };
  // variables
  export const SET_VARIABLE_VALUE: Command = {
    id: 'debug.variables.setValue',
  };
  export const COPY_VARIABLE_VALUE: Command = {
    id: 'debug.variables.copy',
  };
  export const COPY_EVALUATE_PATH: Command = {
    id: 'debug.evaluate.copy',
  };
  export const ADD_TO_WATCH_ID: Command = {
    id: 'debug.addToWatchExpressions',
  };
  export const VIEW_MEMORY_ID: Command = {
    id: 'debug.variables.view.memory',
  };
  // console commands
  export const CLEAR_CONSOLE: Command = {
    id: 'debug.console.clear',
    label: '%debug.console.clear%',
  };
  export const COPY_CONSOLE_ITEM: Command = {
    id: 'debug.console.copy',
  };
  export const COPY_CONSOLE_ALL: Command = {
    id: 'debug.console.copyALl',
  };
  export const COLLAPSE_ALL_CONSOLE_ITEM: Command = {
    id: 'debug.console.collapseAll',
    label: '%debug.console.collapseAll%',
  };
  export const CONSOLE_ENTER_EVALUATE: Command = {
    id: 'debug.console.keybing.enter.evaluate',
  };
  export const CONSOLE_INPUT_DOWN_ARROW: Command = {
    id: 'debug.console.input.down.arrow',
  };
  export const CONSOLE_INPUT_UP_ARROW: Command = {
    id: 'debug.console.input.up.arrow',
  };
  export const CONSOLE_FILTER_FOCUS: Command = {
    id: 'debug.console.filter.input.focus',
  };
  export const RUN_TO_CURSOR: Command = {
    id: 'debug.action.runToCursor',
    label: '%debug.action.runToCursor%',
  };
  export const FORCE_RUN_TO_CURSOR: Command = {
    id: 'debug.action.forceRunToCursor',
    label: '%debug.action.forceRunToCursor%',
  };
  // exception widget
  export const EXCEPTION_WIDGET_CLOSE: Command = {
    id: 'debug.action.closeExceptionWidget',
  };
  export const SHOW_ALL_AUTOMATIC_DEBUG_CONFIGURATIONS: Command = {
    id: 'debug.showAllAutomaticDebugConfigurations',
  };
}
