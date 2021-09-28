import '@ali/ide-i18n';
import { CommonBrowserModules } from '@ali/ide-startup/lib/browser/common-modules';
import { BrowserModule, ConstructorOf, SlotLocation, IClientAppOpts } from '@ali/ide-core-browser';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import '@ali/ide-core-browser/lib/style/index.less';
// 只有本地 ide 需要引入该文件
// import '@ali/ide-core-browser/lib/style/icon.less';

import { renderApp } from './app';
import './style.less';

export const modules: ConstructorOf<BrowserModule>[] = [
  ...CommonBrowserModules,
  ExpressFileServerModule,
];

const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar', 'toolbar'],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-search', '@ali/ide-scm', '@ali/ide-extension-manager', '@ali/ide-debug'],
  },
  [SlotLocation.action]: {
    modules: ['@ali/ide-toolbar-action'],
  },
  [SlotLocation.right]: {
    modules: [],
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

const customClientOpts = ((window as any).KAITIAN_CLIENT_OPTS || {}) as IClientAppOpts;

renderApp({
  layoutConfig,
  useCdnIcon: true,
  modules,
  ...customClientOpts,
  defaultPreferences: {
    'application.confirmExit': 'never',
    'general.theme': 'ide-dark',
    'general.icon': 'vscode-icons',
    ...customClientOpts.defaultPreferences,
  },
});
