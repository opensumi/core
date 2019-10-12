import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../../src/browser/common-modules';
import { StartupModule } from '../../src/browser';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';
// 引入本地icon，不使用cdn版本，与useLocalIcon配套使用
// import '@ali/ide-core-browser/lib/style/icon.less';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ExpressFileServerModule,
    StartupModule,
  ],
  layoutConfig: defaultConfig,
  // useLocalIcon: true,
  // iconStyleSheets: [
  //   {
  //     iconMap: {
  //       eye: 'shake',
  //     },
  //     prefix: 'tbe tbe-',
  //     cssPath: '//at.alicdn.com/t/font_403404_1qiu0eed62f.css',
  //   },
  // ],
});
