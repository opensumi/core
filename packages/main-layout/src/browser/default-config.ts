import { LayoutConfig, SlotLocation } from '@ali/ide-core-browser';

// TODO 支持layout样式名自定义
export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm', '@ali/ide-extension-manager'],
  },
  [SlotLocation.right]: {
    modules: [],
    // modules: [],
    size: 350,
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ali/ide-terminal2', '@ali/ide-output'],
  },
  [SlotLocation.bottomBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.leftBar]: {
    modules: ['@ali/ide-activity-bar/left'],
  },
  [SlotLocation.leftPanel]: {
    modules: ['@ali/ide-activity-panel/left'],
  },
  [SlotLocation.rightBar]: {
    modules: ['@ali/ide-activity-bar/right'],
  },
  [SlotLocation.rightPanel]: {
    modules: ['@ali/ide-activity-panel/right'],
  },
};
