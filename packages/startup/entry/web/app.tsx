/* eslint-disable import/order */
// eslint-disable-next-line import/order
import React from 'react';
import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';
const defaultLanguage = LOCALE_TYPES.EN_US;
// eslint-disable-next-line import/order
import { setLocale } from '@opensumi/ide-monaco/lib/browser/monaco-localize';
// 请注意，集成方在这里需要自己传一个正确的 locale 进去
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale(defaultLanguage);

import '@opensumi/ide-i18n';
import '@opensumi/ide-core-browser/lib/style/index.less';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';

import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';
import { CommonBrowserModules as CommonLiteBrowserModules } from '../web-lite/common-modules';
import { WebLiteModule } from '../web-lite/lite-module';
import { layoutConfig as layoutLiteConfig } from '../web-lite/app';
import { renderApp as renderLiteApp } from '../web-lite/render-app';

import { renderApp } from './render-app';

import '../styles.less';

const layoutConfig = {
  ...defaultConfig,
  ...{
    [SlotLocation.top]: {
      modules: ['menubar', 'toolbar'],
    },
  },
  ...{
    [SlotLocation.action]: {
      modules: ['@opensumi/ide-toolbar-action'],
    },
  },
};

renderLiteApp({
  modules: [WebLiteModule, ...CommonLiteBrowserModules],
  layoutConfig: layoutLiteConfig,
  useCdnIcon: true,
  useExperimentalShadowDom: true,
  noExtHost: true,
  defaultPreferences: {
    'general.theme': 'ide-light',
    'general.icon': 'vsicons-slim',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
    'editor.quickSuggestionsMaxCount': 50,
    'editor.scrollBeyondLastLine': false,
    'general.language': LOCALE_TYPES.EN_US,
  },
  workspaceDir: './',
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

renderApp({
  modules: [...CommonBrowserModules, ExpressFileServerModule, SampleModule],
  layoutConfig,
  useCdnIcon: false,
  useExperimentalShadowDom: true,
  defaultPreferences: {
    'general.language': defaultLanguage,
    'general.theme': 'opensumi-dark',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
  },
  defaultPanels: {
    bottom: '@opensumi/ide-terminal-next',
    right: '',
  },
  // 当 `.sumi` 下不存在配置文件时，默认采用 `.vscode` 下的配置
  useVSCodeWorkspaceConfiguration: true,
  // 开启 core-browser 对 OpenSumi DevTools 的支持，默认为关闭
  devtools: true,
});
