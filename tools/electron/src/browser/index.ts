const win = window as any;
win.Buffer = win.BufferBridge;
if (!(window as any).process) {
  (window as any).process = { browser: true, env: (window as any).env, listener: () => [] };
}

import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { ElectronBasicModule } from '@ali/ide-electron-basic/lib/browser';
import { renderApp } from './app';
import { CommonBrowserModules } from '@ali/ide-startup/lib/browser/common-modules';
import { StartupModule } from '@ali/ide-startup/lib/browser';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ElectronBasicModule,
    StartupModule,
  ],
  layoutConfig: defaultConfig,
});
