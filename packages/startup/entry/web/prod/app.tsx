import { AIModules } from '@opensumi/ide-startup/lib/browser/common-modules';

import { getDefaultClientAppOpts, renderApp } from '../render-app';

const hostname = window.location.hostname;
const port = window.location.port;

renderApp(
  getDefaultClientAppOpts({
    modules: [...AIModules],
    opts: {
      webviewEndpoint: '/webview',
      extWorkerHost: '/worker-host.js',
      wsPath: window.location.protocol === 'https:' ? `wss://${hostname}:${port}` : `ws://${hostname}:${port}`,
    },
  }),
);
