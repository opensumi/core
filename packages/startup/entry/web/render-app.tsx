// eslint-disable-next-line no-console
console.time('Render');

import { Injector } from '@opensumi/di';
import { IClientAppOpts, SlotLocation, registerLocalStorageProvider } from '@opensumi/ide-core-browser';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { GeneralSettingsId, uuid } from '@opensumi/ide-core-common';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { RemoteOpenerModule } from '@opensumi/ide-remote-opener/lib/browser';

import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';

import { DefaultLayout } from './layout';

const CLIENT_ID = 'W_' + uuid();

export async function renderApp(opts: IClientAppOpts) {
  const defaultHost = process.env.HOST || window.location.hostname;
  const injector = new Injector();
  opts.workspaceDir =
    opts.workspaceDir || process.env.SUPPORT_LOAD_WORKSPACE_BY_HASH
      ? window.location.hash.slice(1)
      : process.env.WORKSPACE_DIR;

  opts.injector = injector;
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath = opts.wsPath || process.env.WS_PATH || `ws://${defaultHost}:8000`;

  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST;

  const anotherHostName = process.env.WEBVIEW_HOST || defaultHost;
  opts.webviewEndpoint = opts.webviewEndpoint || `http://${anotherHostName}:8899`;

  opts.editorBackgroundImage =
    'https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg';
  opts.layoutComponent = DefaultLayout;
  opts.clientId = CLIENT_ID;
  opts.didRendered = () => {
    // eslint-disable-next-line no-console
    console.timeEnd('Render');
  };
  registerLocalStorageProvider(GeneralSettingsId.Theme, opts.workspaceDir || '', 'prefix1');

  const app = new ClientApp(opts);

  app.fireOnReload = (forcedReload: boolean) => {
    window.location.reload();
  };

  app.start(document.getElementById('main')!, 'web');
}

export const getDefaultClientAppOpts = ({
  defaultLanguage,
  opts = {},
}: {
  defaultLanguage: string;
  opts?: Partial<IClientAppOpts>;
}): IClientAppOpts => ({
  modules: [...CommonBrowserModules, ExpressFileServerModule, SampleModule, RemoteOpenerModule],
  layoutConfig: {
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
  },
  useCdnIcon: true,
  useExperimentalShadowDom: true,
  defaultPreferences: {
    'general.language': defaultLanguage,
    'general.theme': 'opensumi-dark',
    'general.icon': 'vscode-icons',
    'general.productIconTheme': 'opensumi-icons',
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
  ...opts,
});
