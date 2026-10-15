import { SlotLocation } from '@opensumi/ide-core-browser';
import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '@opensumi/ide-design';
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
      layoutViewSize: {
        menubarHeight: 32,
      },
      layoutConfig: {
        [SlotLocation.top]: {
          modules: [DESIGN_MENUBAR_CONTAINER_VIEW_ID],
        },
      },
    },
  }),
);
