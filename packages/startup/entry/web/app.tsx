import { AI_MENU_BAR_LEFT, AiTopLayoutConfig } from '@opensumi/ide-ai-native/lib/browser/override/layout/layout-config';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { setLocale } from '@opensumi/ide-monaco/lib/browser/monaco-localize';
import { RemoteOpenerModule } from '@opensumi/ide-remote-opener/lib/browser';

const defaultLanguage = LOCALE_TYPES.EN_US;
// 请注意，集成方在这里需要自己传一个正确的 locale 进去
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale(defaultLanguage);

import '@opensumi/ide-core-browser/lib/style/index.less';
import '@opensumi/ide-i18n';

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
        modules: ['ai_menubar'],
      },
    },
    ...{
      [SlotLocation.action]: {
        modules: ['@opensumi/ide-toolbar-action'],
      },
    },
    ...AiTopLayoutConfig,
    [AI_MENU_BAR_LEFT]: {
      modules: ['AI_MENU_BAR_DEBUG_TOOLBAR'],
    },
  },
  useCdnIcon: true,
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
