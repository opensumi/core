import '@opensumi/ide-i18n';
import { SlotLocation } from '@opensumi/ide-core-browser';
import React from 'react';

import { CommonBrowserModules } from './common-modules';
import { renderApp } from './render-app';

// 引入公共样式文件
import '@opensumi/ide-core-browser/lib/style/index.less';

import { WebLiteModule } from './web-lite-module';

// import * as serviceWorker from './service-worker';

import '../styles.less';
import { LayoutComponent } from './modules/view/custom-layout-component';

// 视图和slot插槽的对应关系
const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@opensumi/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: [''],
  },
  [SlotLocation.left]: {
    modules: ['@opensumi/ide-explorer', '@opensumi/ide-scm'],
  },
  [SlotLocation.right]: {
    modules: ['@opensumi/ide-dw-right'],
  },
  [SlotLocation.main]: {
    modules: ['@opensumi/ide-editor'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@opensumi/ide-status-bar'],
  },
  [SlotLocation.extra]: {
    modules: [],
  },
};

// optional for sw registration
// serviceWorker.register();

renderApp({
  modules: [ ...CommonBrowserModules, WebLiteModule ],
  layoutConfig,
  layoutComponent: LayoutComponent,
  useCdnIcon: true,
  noExtHost: true,
  extWorkerHost: 'https://dev.g.alicdn.com/tao-ide/ide-lite/0.0.1/worker-host.js',
  defaultPreferences: {
    'general.theme': 'tao-ide-dark',
    'general.icon': 'vsicons-slim',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.scrollBeyondLastLine': false,
    'general.language': 'en-US',
  },
  workspaceDir: '/ide-s/TypeScript-Node-Starter',
  extraContextProvider: (props) => <div id='#hi' style={{ width: '100%', height: '100%' }}>{props.children}</div>,
  iconStyleSheets: [
    {
      iconMap: {
        explorer: 'fanhui',
        shangchuan: 'shangchuan',
      },
      prefix: 'tbe tbe-',
      cssPath: '//at.alicdn.com/t/font_1432262_qwu5r5q6rd.css',
    },
  ],
});
