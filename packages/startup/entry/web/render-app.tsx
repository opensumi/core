// eslint-disable-next-line no-console
console.time('Render');

import { Injector } from '@opensumi/di';
import { IClientAppOpts } from '@opensumi/ide-core-browser';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { ClientApp } from '@opensumi/ide-core-browser/lib/bootstrap/app';
import { uuid } from '@opensumi/ide-core-common';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/browser';
import { defaultConfig } from '@opensumi/ide-main-layout/lib/browser/default-config';
import { RemoteOpenerModule } from '@opensumi/ide-remote-opener/lib/browser';

import { CommonBrowserModules } from '../../src/browser/common-modules';
import { SampleModule } from '../sample-modules';

import { DefaultLayout } from './layout';

const envServerPort = process.env.PORT || process.env.IDE_SERVER_PORT || 8000;

const CLIENT_ID = 'W_' + uuid();

export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.workspaceDir =
    opts.workspaceDir || process.env.SUPPORT_LOAD_WORKSPACE_BY_HASH
      ? window.location.hash.slice(1)
      : process.env.WORKSPACE_DIR;

  const hostname = process.env.HOST || window.location.hostname;
  const serverPort = process.env.NODE_ENV !== 'production' ? envServerPort : window.location.port;
  const webviewEndpointPort = process.env.NODE_ENV !== 'production' ? 8899 : window.location.port;

  opts.injector = injector;
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath =
    process.env.WS_PATH ||
    (window.location.protocol === 'https:' ? `wss://${hostname}:${serverPort}` : `ws://${hostname}:${serverPort}`);
  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST;
  const anotherHostName = process.env.WEBVIEW_HOST || hostname;
  opts.webviewEndpoint = opts.webviewEndpoint || `http://${anotherHostName}:${webviewEndpointPort}`;
  opts.editorBackgroundImage =
    'https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg';
  opts.layoutComponent = DefaultLayout;
  opts.clientId = CLIENT_ID;
  opts.didRendered = () => {
    // eslint-disable-next-line no-console
    console.timeEnd('Render');
  };

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
