/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@ali/ide-core-browser';

export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm', '@ali/ide-extension-manager'],
  },
  [SlotLocation.right]: {
    modules: ['@ali/ide-debug'],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ali/ide-terminal-next', '@ali/ide-output', 'debug-console', '@ali/ide-markers'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: ['breadcrumb-menu'],
  },
};
