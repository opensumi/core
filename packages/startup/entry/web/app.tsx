import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../common/browser';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

renderApp({
  modules: [
    ...CommonBrowserModules,
  ],
  layoutConfig: defaultConfig,
});
