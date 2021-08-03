import { LayoutConfig, SlotLocation } from '@ali/ide-core-browser';

export const customLayoutConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar', 'topbar', 'toolbar'],
  },
  [SlotLocation.action]: {
    modules: ['@ali/ide-toolbar-action'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm', '@ali/ide-extension-manager', '@ali/ide-debug'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ali/ide-terminal-next', '@ali/ide-output', 'debug-console', '@ali/ide-markers', '@ali/ide-refactor-preview'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: ['breadcrumb-menu'],
  },
};
