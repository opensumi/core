import '@opensumi/ide-i18n';
import { BrowserModule, ConstructorOf, IClientAppOpts } from '@opensumi/ide-core-browser';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { CommonBrowserModules } from '@opensumi/ide-startup/lib/browser/common-modules';
import '@opensumi/ide-core-browser/lib/style/index.less';

import { renderApp } from './app';
import './style.less';

export const modules: ConstructorOf<BrowserModule>[] = [...CommonBrowserModules, ExpressFileServerModule];

const customClientOpts = ((window as any).SUMI_CLIENT_OPTS || {}) as IClientAppOpts;

renderApp({
  layoutConfig: defaultConfig,
  useCdnIcon: true,
  // @ts-ignore
  modules,
  ...customClientOpts,
  defaultPreferences: {
    'application.confirmExit': 'never',
    'general.theme': 'ide-dark',
    'general.icon': 'vscode-icons',
    ...customClientOpts.defaultPreferences,
  },
});
