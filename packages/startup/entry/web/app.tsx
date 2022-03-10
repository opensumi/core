// eslint-disable-next-line import/order
import { setLocale } from '@opensumi/ide-monaco/lib/browser/monaco-localize';
// 这里建议传实际 preferences 的设置项
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale('zh-CN');
import '@opensumi/ide-i18n';
import '@opensumi/ide-core-browser/lib/style/index.less';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { RemoteOpenerModule } from '@opensumi/ide-remote-opener/lib/browser';

import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';

import { renderApp } from './render-app';

import '../styles.less';

renderApp({
  modules: [...CommonBrowserModules, ExpressFileServerModule, SampleModule, RemoteOpenerModule],
  layoutConfig: {
    ...defaultConfig,
    ...{
      [SlotLocation.top]: {
        modules: ['@opensumi/menu-bar-example', 'toolbar'],
      },
    },
    ...{
      [SlotLocation.action]: {
        modules: ['@opensumi/ide-toolbar-action'],
      },
    },
  },
  useCdnIcon: true,
  useExperimentalShadowDom: true,
  defaultPreferences: {
    'general.theme': 'opensumi-dark',
    'general.icon': 'vscode-icons',
    'application.confirmExit': 'never',
    'editor.quickSuggestionsDelay': 100,
  },
  defaultPanels: {
    bottom: '@opensumi/ide-terminal-next',
    right: '',
  },
});
