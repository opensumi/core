import { setLocale } from '@ali/ide-monaco/lib/browser/monaco-localize';
// 这里建议传实际 preferences 的设置项
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale('zh-CN');
import '@ali/ide-i18n';
import '@ali/ide-core-browser/lib/style/index.less';
import { ExpressFileServerModule } from '@ali/ide-express-file-server/lib/browser';
import { SlotLocation } from '@ali/ide-core-browser';
import { defaultConfig } from '@ali/ide-main-layout/lib/browser/default-config';

import { renderApp } from './render-app';
import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';

import '../styles.less';

renderApp({
  modules: [
    ...CommonBrowserModules,
    ExpressFileServerModule,
    SampleModule,
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
  useCdnIcon: true,
  useExperimentalShadowDom: true,
  defaultPreferences: {
    'general.theme': 'ide-dark',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
  },
  defaultPanels: {
    'bottom': '@ali/ide-terminal-next',
    'right': '',
  },
});
