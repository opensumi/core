import { setLocale } from '@ide-framework/ide-monaco/lib/browser/monaco-localize';
// 这里建议传实际 preferences 的设置项
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale('zh-CN');
import '@ide-framework/ide-i18n';
import '@ide-framework/ide-core-browser/lib/style/index.less';
import { ExpressFileServerModule } from '@ide-framework/ide-express-file-server/lib/browser';
import { SlotLocation } from '@ide-framework/ide-core-browser';
import { defaultConfig } from '@ide-framework/ide-main-layout/lib/browser/default-config';

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
      modules: ['@ide-framework/ide-menu-bar', 'toolbar'],
    }},
    ...{[SlotLocation.action]: {
      modules: ['@ide-framework/ide-toolbar-action'],
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
    'bottom': '@ide-framework/ide-terminal-next',
    'right': '',
  },
});
