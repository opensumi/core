import '@ali/ide-i18n/lib/browser';
import { SlotLocation } from '@ali/ide-core-browser';
import { loadMonaco } from '@ali/ide-monaco/lib/browser/monaco-loader';

import { CommonBrowserModules } from './common-modules';
import { renderApp } from './render-app';

// 引入公共样式文件
import '@ali/ide-core-browser/lib/style/index.less';

import { WebLiteModule } from './web-lite-module';

import * as serviceWorker from './service-worker';

import '../styles.less';
import { LayoutComponent } from './modules/view/custom-layout-component';

// 视图和slot插槽的对应关系
const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@ali/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: [''],
  },
  [SlotLocation.left]: {
    modules: ['@ali/ide-explorer', '@ali/ide-scm'],
  },
  [SlotLocation.right]: {
    modules: ['@ali/ide-dw-right'],
  },
  [SlotLocation.main]: {
    modules: ['@ali/ide-editor'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@ali/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: [],
  },
};

loadMonaco({
  monacoCDNBase: 'https://g.alicdn.com/tb-ide/monaco-editor-core/0.17.0/',
});

// optional for sw registration
serviceWorker.register();

renderApp({
  modules: [ ...CommonBrowserModules, WebLiteModule ],
  layoutConfig,
  layoutComponent: LayoutComponent,
  useCdnIcon: true,
  noExtHost: true,
  extWorkerHost: 'https://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1/worker-host.js',
  defaultPreferences: {
    'general.theme': 'Default Dark+',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.quickSuggestionsMaxCount': 50,
  },
  workspaceDir: '/ide-s/TypeScript-Node-Starter',
  iconStyleSheets: [
    {
      iconMap: {
        explorer: 'fanhui',
        shangchuan: 'shangchuan',
      },
      prefix: 'tbe tbe-',
      cssPath: '//at.alicdn.com/t/font_403404_1qiu0eed62f.css',
    },
  ],
});
