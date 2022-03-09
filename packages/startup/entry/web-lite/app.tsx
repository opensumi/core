import '@opensumi/ide-i18n/lib/browser';
import * as React from 'react';

import { SlotLocation } from '@opensumi/ide-core-browser';

import { SampleModule } from '../sample-modules';

import { CommonBrowserModules } from './common-modules';
import { WebLiteModule } from './lite-module';
import { renderApp } from './render-app';

// 引入公共样式文件
import '@opensumi/ide-core-browser/lib/style/index.less';
import './styles.less';

// 视图和slot插槽的对应关系
const layoutConfig = {
  [SlotLocation.top]: {
    modules: ['@opensumi/ide-menu-bar'],
  },
  [SlotLocation.action]: {
    modules: [''],
  },
  [SlotLocation.left]: {
    modules: ['@opensumi/ide-explorer', 'test-view'],
  },
  [SlotLocation.main]: {
    modules: ['@opensumi/ide-editor'],
  },
  [SlotLocation.statusBar]: {
    modules: ['@opensumi/ide-status-bar'],
  },
  [SlotLocation.bottom]: {
    modules: ['@opensumi/ide-output'],
  },
  [SlotLocation.extra]: {
    modules: [],
  },
};

// optional for sw registration
// serviceWorker.register();

renderApp({
  modules: [WebLiteModule, ...CommonBrowserModules, SampleModule],
  layoutConfig,
  useCdnIcon: true,
  noExtHost: true,
  defaultPreferences: {
    'general.theme': 'ide-light',
    'general.icon': 'vsicons-slim',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.quickSuggestionsMaxCount': 50,
    'editor.scrollBeyondLastLine': false,
    'general.language': 'en-US',
  },
  workspaceDir: '/test',
  extraContextProvider: (props) => (
    <div id='#hi' style={{ width: '100%', height: '100%' }}>
      {props.children}
    </div>
  ),
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
