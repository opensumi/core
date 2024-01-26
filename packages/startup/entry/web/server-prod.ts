/* eslint-disable no-console */
import http from 'http';
import path from 'path';

import { ensureDir } from 'fs-extra';
import Koa from 'koa';
import Static from 'koa-static';

import { Deferred } from '@opensumi/ide-core-common';
import { DEFAULT_TRS_REGISTRY } from '@opensumi/ide-core-common/lib/const/application';
import { IServerAppOpts, ServerApp, NodeModule } from '@opensumi/ide-core-node';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';

import { CommonNodeModules } from '../../src/node/common-modules';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const app = new Koa();
  const deferred = new Deferred<http.Server>();
  process.env.EXT_MODE = 'js';

  const port = process.env.PORT || 8000;

  const workspaceDir = process.env.WORKSPACE_DIR || path.join(__dirname, '../../../tools/workspace');
  await ensureDir(workspaceDir);

  const extensionDir = process.env.EXTENSION_DIR || path.join(__dirname, '../../../tools/extensions');

  let opts: IServerAppOpts = {
    use: app.use.bind(app),
    processCloseExitThreshold: 5 * 60 * 1000,
    terminalPtyCloseThreshold: 5 * 60 * 1000,
    staticAllowOrigin: '*',
    staticAllowPath: [workspaceDir, extensionDir, '/'],
    extHost: path.join(__dirname, '../../../extension/lib/hosted/ext.process.js'),
    onDidCreateExtensionHostProcess: (extHostProcess) => {
      console.log(`Extension host process ${extHostProcess.pid} created`);
    },
  };

  opts.marketplace = {
    endpoint: DEFAULT_TRS_REGISTRY.ENDPOINT,
    accountId: DEFAULT_TRS_REGISTRY.ACCOUNT_ID,
    masterKey: DEFAULT_TRS_REGISTRY.MASTER_KEY,
    showBuiltinExtensions: true,
  };

  if (Array.isArray(arg1)) {
    opts = {
      ...opts,
      modulesInstances: arg1,
    };
  } else {
    opts = {
      ...opts,
      ...arg1,
    };
  }

  const serverApp = new ServerApp(opts);
  const server = http.createServer(app.callback());

  app.use(Static(path.join(__dirname, '../../dist')));

  await serverApp.start(server);

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('Server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(port, () => {
    console.log(`Server listen on port ${port}`);
    deferred.resolve(server);
  });
  return deferred.promise;
}

startServer({
  modules: [...CommonNodeModules, ExpressFileServerModule],
});
