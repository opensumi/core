/* eslint-disable import/order */

// eslint-disable-next-line no-console
console.time('Render');

import '@opensumi/ide-core-browser/lib/style/index.less';
import '../styles.less';

import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';
import { setLocale } from '@opensumi/ide-monaco/lib/browser/monaco-localize';

const defaultLanguage = LOCALE_TYPES.EN_US;

// 请注意，集成方在这里需要自己传一个正确的 locale 进去
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale(defaultLanguage);

import '@opensumi/ide-i18n';

import { Injector } from '@opensumi/di';
import { BrowserModule, IClientAppOpts, SlotLocation, registerLocalStorageProvider } from '@opensumi/ide-core-browser';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { ConstructorOf, GeneralSettingsId, findFirstTruthy, uuid } from '@opensumi/ide-core-common';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { RemoteOpenerModule } from '@opensumi/ide-remote-opener/lib/browser';

import { AI_CHAT_LOGO_AVATAR_ID } from '@opensumi/ide-ai-native';
import { AILayout } from '@opensumi/ide-ai-native/lib/browser/layout/ai-layout';
import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';

const CLIENT_ID = 'W_' + uuid();

const queries = new URLSearchParams(window.location.search);

export async function renderApp(opts: IClientAppOpts) {
  // eslint-disable-next-line no-console
  console.time('Render');

  const defaultHost = process.env.HOST || window.location.hostname;
  const injector = new Injector();

  opts.workspaceDir = findFirstTruthy(
    () => queries.get('workspaceDir') || undefined,
    process.env.SUPPORT_LOAD_WORKSPACE_BY_HASH && window.location.hash.slice(1),
    opts.workspaceDir,
    process.env.WORKSPACE_DIR,
  );
  opts.extensionDevelopmentPath = findFirstTruthy(
    () => queries.get('extensionDevelopmentPath') || undefined,
    process.env.EXTENSION_DEVELOPMENT_PATH,
  );

  opts.injector = injector;
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath = opts.wsPath || process.env.WS_PATH || `ws://${defaultHost}:8000`;

  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST;

  opts.editorBackgroundImage =
    'https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg';

  opts.clientId = CLIENT_ID;
  opts.didRendered = () => {
    // eslint-disable-next-line no-console
    console.timeEnd('Render');
  };
  registerLocalStorageProvider(GeneralSettingsId.Theme, opts.workspaceDir || '', 'sumi-dev');

  const app = new ClientApp(opts);

  app.fireOnReload = (forcedReload: boolean) => {
    window.location.reload();
  };

  app.start(document.getElementById('main')!, 'web');
}

export const getDefaultClientAppOpts = ({
  modules = [],
  opts = {},
}: {
  modules?: ConstructorOf<BrowserModule>[];
  opts?: Partial<IClientAppOpts>;
}): IClientAppOpts => {
  const { layoutConfig, ...restOpt } = opts;

  return {
    modules: [...CommonBrowserModules, ExpressFileServerModule, SampleModule, RemoteOpenerModule, ...modules],
    layoutConfig: {
      ...defaultConfig,
      [SlotLocation.top]: {
        modules: ['menubar', 'toolbar'],
      },
      [SlotLocation.action]: {
        modules: ['@opensumi/ide-toolbar-action'],
      },
      [DESIGN_MENU_BAR_RIGHT]: {
        modules: [AI_CHAT_LOGO_AVATAR_ID],
      },
      ...layoutConfig,
    },
    useCdnIcon: true,
    useExperimentalShadowDom: true,
    useBuiltinWebview: true,
    defaultPreferences: {
      'general.language': defaultLanguage,
      'general.theme': 'opensumi-design-dark-theme',
      'general.icon': 'vscode-icons',
      'general.productIconTheme': 'opensumi-icons',
      'application.confirmExit': 'never',
      'editor.quickSuggestionsDelay': 100,
      'editor.largeFile': 1048576, // 1MB for invalidcation
      'editor.largeFileOptimizations': true,
    },
    defaultPanels: {
      [SlotLocation.panel]: '@opensumi/ide-terminal-next',
      [SlotLocation.extendView]: '',
    },
    // 当 `.sumi` 下不存在配置文件时，默认采用 `.vscode` 下的配置
    useVSCodeWorkspaceConfiguration: true,
    // 开启 core-browser 对 OpenSumi DevTools 的支持，默认为关闭
    devtools: true,
    designLayout: {
      useMenubarView: true,
      useMergeRightWithLeftPanel: true,
    },
    layoutComponent: AILayout,
    ...restOpt,
  };
};
