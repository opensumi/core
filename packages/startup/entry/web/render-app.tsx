// eslint-disable-next-line no-console
console.time('Render');
import { generate } from 'shortid';

import { Injector } from '@opensumi/di';
import { ClientApp, IClientAppOpts } from '@opensumi/ide-core-browser';
import { ToolbarActionBasedLayout } from '@opensumi/ide-core-browser/lib/components';

const CLIENT_ID = 'W_' + generate();
export async function renderApp(opts: IClientAppOpts) {
  const injector = new Injector();
  opts.workspaceDir = opts.workspaceDir || process.env.WORKSPACE_DIR;

  opts.injector = injector;
  opts.extensionDir = opts.extensionDir || process.env.EXTENSION_DIR;
  opts.wsPath = process.env.WS_PATH || 'ws://0.0.0.0:8000';

  opts.extWorkerHost = opts.extWorkerHost || process.env.EXTENSION_WORKER_HOST;
  const anotherHostName =
    process.env.WEBVIEW_HOST || (window.location.hostname === 'localhost' ? '0.0.0.0' : 'localhost');
  opts.webviewEndpoint = `http://${anotherHostName}:8899`;
  opts.editorBackgroundImage =
    'https://img.alicdn.com/imgextra/i2/O1CN01dqjQei1tpbj9z9VPH_!!6000000005951-55-tps-87-78.svg';
  opts.layoutComponent = ToolbarActionBasedLayout;
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
