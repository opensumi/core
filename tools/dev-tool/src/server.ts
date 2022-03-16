/* eslint-disable no-console */
import 'tsconfig-paths/register';
import http from 'http';
import path from 'path';

import Koa from 'koa';
import KoaRouter from 'koa-router';

import { Injector } from '@opensumi/di';
import { Deferred } from '@opensumi/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@opensumi/ide-core-node';
import {
  IExternalFileArgs,
  IExternalUrlArgs,
  IRemoteOpenerClient,
  RemoteOpenerClientToken,
  RemoteOpenerServiceToken,
} from '@opensumi/ide-remote-opener/lib/common';
import { RemoteOpenerServiceImpl } from '@opensumi/ide-remote-opener/lib/node';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const app = new Koa();
  const router = new KoaRouter();
  const deferred = new Deferred<http.Server>();

  router.get('/open', (ctx) => {
    const openerService: IRemoteOpenerClient = injector.get(RemoteOpenerClientToken);
    try {
      console.log('received open request', ctx.query);
      openerService.openExternal(
        ctx.query as unknown as IExternalFileArgs | IExternalUrlArgs,
        ctx.query.clientId as unknown as string,
      );
      ctx.body = 'successful';
    } catch (err: any) {
      ctx.body = `Error: ${err.message}`;
    }
  });

  app.use(router.routes());

  const injector = new Injector([
    {
      token: RemoteOpenerServiceToken,
      useClass: RemoteOpenerServiceImpl,
    },
  ]);

  const port = process.env.IDE_SERVER_PORT || 8000;
  let opts: IServerAppOpts = {
    webSocketHandler: [
      // new TerminalHandler(logger),
    ],
    injector,
    use: app.use.bind(app),
    marketplace: {
      endpoint: 'https://open-vsx.org/api',
      showBuiltinExtensions: true,
    },
    processCloseExitThreshold: 5 * 60 * 1000,
    terminalPtyCloseThreshold: 5 * 60 * 1000,
    staticAllowOrigin: '*',
    staticAllowPath: [path.join(__dirname, '../../../packages/extension'), '/'],
    extLogServiceClassPath: path.join(__dirname, './mock-log-service.js'),
    /**
     * 集成时可使用自定义的 extHost 入口传入内置 command
     *  extHost: path.join(__dirname, './ext-host.js') || process.env.EXTENSION_HOST_ENTRY,
     */
    extHost:
      path.join(__dirname, '../../../packages/extension/lib/hosted/ext.process.js') || process.env.EXTENSION_HOST_ENTRY,
    onDidCreateExtensionHostProcess: (extProcess) => {
      console.log('onDidCreateExtensionHostProcess extProcess.pid', extProcess.pid);
    },
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
  // server 必须在 ServerApp 实例化后才能创建，因为依赖 app 里收集的中间件
  const server = http.createServer(app.callback());

  await serverApp.start(server);

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(port, () => {
    console.log(`server listen on port ${port}`);
    deferred.resolve(server);
  });
  return deferred.promise;
}
