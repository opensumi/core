/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@ali/ide-core-browser';

// FIXME bar和panel不要对外暴露，直接模块间依赖
// TODO 支持layout样式名自定义
export const defaultConfig: LayoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm', '@ali/ide-debug', '@ali/ide-extension-manager'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ali/ide-terminal2', '@ali/ide-output', 'debug-console', '@ali/ide-markers'],
  },
  [SlotLocation.statusBar]: {
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
  [SlotLocation.bottomBar]: {
    modules: ['@ali/ide-activity-bar/bottom'],
  },
  [SlotLocation.bottomPanel]: {
    modules: ['@ali/ide-activity-panel/bottom'],
  },
};
