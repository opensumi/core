import '@opensumi/ide-i18n';
import { CommonBrowserModules } from '@opensumi/ide-startup/lib/browser/common-modules';
import { BrowserModule, ConstructorOf, SlotLocation, IClientAppOpts } from '@opensumi/ide-core-browser';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import '@opensumi/ide-core-browser/lib/style/index.less';
// 只有本地 ide 需要引入该文件
// import '@opensumi/ide-core-browser/lib/style/icon.less';

import { renderApp } from './app';
import './style.less';

export const modules: ConstructorOf<BrowserModule>[] = [
  ...CommonBrowserModules,
  ExpressFileServerModule,
];

const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@opensumi/ide-menu-bar', 'toolbar'],
  },
  [SlotLocation.left]: {
    modules: ['@opensumi/ide-explorer', '@opensumi/ide-search', '@opensumi/ide-scm', '@opensumi/ide-extension-manager', '@opensumi/ide-debug'],
  },
  [SlotLocation.action]: {
    modules: ['@opensumi/ide-toolbar-action'],
  },
  [SlotLocation.right]: {
    modules: [],
  },
  [SlotLocation.main]: {
    modules: ['@opensumi/ide-editor'],
  },
  [SlotLocation.bottom]: {
    modules: ['@opensumi/ide-terminal-next', '@opensumi/ide-output', 'debug-console', '@opensumi/ide-markers'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@opensumi/ide-status-bar'],
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
