const win = window as any;
win.Buffer = win.BufferBridge;

import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { ElectronBasicModule } from '@ali/ide-electron-basic/lib/browser';
import { renderApp } from './app';
import { CommonBrowserModules } from '../../common/browser';
import { StartupModule } from '../../../src/browser';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ElectronBasicModule,
    StartupModule,
  ],
  layoutConfig: defaultConfig,
});
