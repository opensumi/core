import '@ide-framework/ide-i18n';
import { CommonBrowserModules } from '@ide-framework/ide-startup/lib/browser/common-modules';
import { BrowserModule, ConstructorOf, SlotLocation, IClientAppOpts } from '@ide-framework/ide-core-browser';
import { ExpressFileServerModule } from '@ide-framework/ide-express-file-server/lib/browser';
import '@ide-framework/ide-core-browser/lib/style/index.less';
// 只有本地 ide 需要引入该文件
// import '@ide-framework/ide-core-browser/lib/style/icon.less';

import { renderApp } from './app';
import './style.less';

export const modules: ConstructorOf<BrowserModule>[] = [
  ...CommonBrowserModules,
  ExpressFileServerModule,
];

const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ide-framework/ide-menu-bar', 'toolbar'],
  },
  [SlotLocation.left]: {
    modules: ['@ide-framework/ide-explorer', '@ide-framework/ide-search', '@ide-framework/ide-scm', '@ide-framework/ide-extension-manager', '@ide-framework/ide-debug'],
  },
  [SlotLocation.action]: {
    modules: ['@ide-framework/ide-toolbar-action'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@ide-framework/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@ide-framework/ide-terminal-next', '@ide-framework/ide-output', 'debug-console', '@ide-framework/ide-markers'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ide-framework/ide-status-bar'],
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
