import '@ali/ide-i18n/lib/browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';
import { renderApp } from './render-app';
import { CommonBrowserModules } from '../../src/browser/common-modules';
import { StartupModule } from '../../src/browser';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';
// 引入本地icon，不使用cdn版本，与useCdnIcon配套使用
import '@ali/ide-core-browser/lib/style/icon.less';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import { SlotLocation } from '@ali/ide-core-browser';

// require('@ali/ide-monaco/lib/browser/monaco-loader').loadMonaco();

renderApp({
  modules: [
    ...CommonBrowserModules,
    ExpressFileServerModule,
    StartupModule,
  ],
  layoutConfig: {
    ...defaultConfig,
    ...{[SlotLocation.top]: {
      modules: ['@ali/ide-menu-bar', 'toolbar'],
    }},
    ...{[SlotLocation.action]: {
      modules: ['@ali/ide-toolbar-action'],
    }},
  },
  useCdnIcon: false,
  useExperimentalShadowDom: true,
  // isSyncPreference: true,
  defaultPreferences: {
    'general.theme': 'ide-dark',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.quickSuggestionsMaxCount': 50,
    // 'terminal.integrated.shellArgs.linux': ['-l'],
    // 'editor.forceReadOnly': true,
  },
  defaultPanels: {
    'bottom': '@ali/ide-terminal-next',
    'right': '',
  },
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
