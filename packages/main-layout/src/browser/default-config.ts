/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@ide-framework/ide-core-browser';

export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ide-framework/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: ['@ide-framework/ide-toolbar-action'],
  },
  [SlotLocation.left]: {
    modules: ['@ide-framework/ide-explorer', '@ide-framework/ide-search', '@ide-framework/ide-scm', '@ide-framework/ide-extension-manager', '@ide-framework/ide-debug'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ide-framework/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ide-framework/ide-terminal-next', '@ide-framework/ide-output', 'debug-console', '@ide-framework/ide-markers', '@ide-framework/ide-refactor-preview'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ide-framework/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: ['breadcrumb-menu'],
  },
};
