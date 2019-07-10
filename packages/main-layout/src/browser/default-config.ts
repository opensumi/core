import {
  SlotLocation,
} from '../common/main-layout-slot';

// TODO 支持layout样式名自定义
export const defaultConfig = {
  [SlotLocation.top]: {
    modules: [],
  },
  left: {
    modules: [],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  // [SlotLocation.main]: {
  //   modules: ['@ali/ide-editor'],
  // },
  [SlotLocation.bottom]: {
    modules: [],
  },
  [SlotLocation.bottomBar]: {
    modules: [],
  },
};
