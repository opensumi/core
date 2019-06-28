import {
  SlotLocation,
} from '../common/main-layout-slot';

// TODO 支持layout样式名自定义
export const defaultConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  left: {
    modules: ['@ali/ide-explorer', '@ali/ide-search'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ali/ide-terminal', '@ali/ide-output'],
  },
  [SlotLocation.bottomBar]: {
    modules: ['@ali/ide-status-bar'],
  },
};
