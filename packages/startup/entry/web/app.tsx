import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../common/browser';
import { StartupModule } from '../../src/browser';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import { SlotLocation } from '@ali/ide-core-browser';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ExpressFileServerModule,
    StartupModule,
  ],
  layoutConfig: {
    [SlotLocation.top]: {
      modules: ['@ali/ide-menu-bar'],
    },
    [SlotLocation.left]: {
      modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm'/*, '@ali/ide-extension-manager'*/],
    },
    [SlotLocation.right]: {
      modules: [/*'@ali/ide-debug'*/],
      size: 350,
    },
    [SlotLocation.main]: {
      modules: ['@ali/ide-editor'],
    },
    [SlotLocation.bottom]: {
      modules: ['@ali/ide-terminal2', '@ali/ide-output'],
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
  },
});
