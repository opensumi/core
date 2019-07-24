import {
  SlotLocation,
} from '../common/main-layout-slot';

// TODO 支持layout样式名自定义
export const defaultConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: [/*'@ali/ide-terminal',*/ '@ali/ide-output'],
  },
  [SlotLocation.bottomBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.leftBar]: {
    modules: ['@ali/ide-activator-bar/left'],
  },
  [SlotLocation.leftPanel]: {
    modules: ['@ali/ide-activator-panel/left'],
  },
  [SlotLocation.rightBar]: {
    modules: ['@ali/ide-activator-bar/right'],
  },
  [SlotLocation.rightPanel]: {
    modules: ['@ali/ide-activator-panel/right'],
  },
};
