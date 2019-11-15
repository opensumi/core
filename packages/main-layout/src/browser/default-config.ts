/* istanbul ignore file */
import { LayoutConfig, SlotLocation } from '@ali/ide-core-browser';

// FIXME bar和panel不要对外暴露，直接模块间依赖
// TODO 支持layout样式名自定义
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
    modules: ['@ali/ide-terminal2', '@ali/ide-markers', '@ali/ide-output', 'debug-console'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: ['breadcrumb-menu'],
  },
};
