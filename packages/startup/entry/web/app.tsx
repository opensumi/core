import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../../src/browser/common-modules';
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
  layoutConfig: defaultConfig,
  workspaceDir: '/Users/munong/Documents/github/mock',
  extensionDir: '/Users/munong/Documents/github/api-server/_extensions',
});
