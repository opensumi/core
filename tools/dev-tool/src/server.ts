/* eslint-disable no-console */
import http from 'http';
import path from 'path';

import Koa from 'koa';
import KoaRouter from 'koa-router';
import Static from 'koa-static';

import { Injector, Provider } from '@opensumi/di';
import { Deferred } from '@opensumi/ide-core-common';
import { IServerAppOpts, NodeModule, ServerApp } from '@opensumi/ide-core-node';
import {
  IExternalFileArgs,
  IExternalUrlArgs,
  IRemoteOpenerClient,
  RemoteOpenerClientToken,
  RemoteOpenerServiceToken,
} from '@opensumi/ide-remote-opener/lib/common';
import { RemoteOpenerServiceImpl } from '@opensumi/ide-remote-opener/lib/node';

export async function startServer(
  arg1: NodeModule[] | Partial<IServerAppOpts>,
  options?: {
    mountStaticPath?: string;
    injector?: Injector;
  },
) {
  const app = new Koa();
  const router = new KoaRouter();
  const deferred = new Deferred<http.Server>();
  const injector = options?.injector ?? new Injector();
  injector.addProviders({
    token: RemoteOpenerServiceToken,
    useClass: RemoteOpenerServiceImpl,
  });

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

  if (options && options.mountStaticPath) {
    console.log('mount static path:', options.mountStaticPath);
    app.use(
      Static(options.mountStaticPath, {
        maxage: 30 * 24 * 60 * 60 * 1000,
      }),
    );
  }

  const port = process.env.PORT || process.env.IDE_SERVER_PORT || 8000;
  let opts: IServerAppOpts = {
    webSocketHandler: [
      // new TerminalHandler(logger),
    ],
    injector,
    use: app.use.bind(app),
    marketplace: {
      showBuiltinExtensions: true,
    },
    processCloseExitThreshold: 5 * 60 * 1000,
    terminalPtyCloseThreshold: 5 * 60 * 1000,
    staticAllowOrigin: '*',
    staticAllowPath: [
      path.join(__dirname, '../../../packages/extension'),
      path.join(__dirname, '../../../tools/extensions'),
      '/',
    ],
    extLogServiceClassPath: path.join(__dirname, './mock-log-service.js'),
    /**
     * 集成时可使用自定义的 extHost 入口传入内置 command
     *  extHost: path.join(__dirname, './ext-host.js') || process.env.EXTENSION_HOST_ENTRY,
     */
    extHost:
      process.env.EXTENSION_HOST_ENTRY || path.join(__dirname, '../../../packages/extension/lib/hosted/ext.process.js'),
    onDidCreateExtensionHostProcess: (extHostProcess) => {
      console.log(`Extension host process ${extHostProcess.pid} created`);
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
    console.log(`server listen on http://localhost:${port}`);
    deferred.resolve(server);
  });
  return deferred.promise;
}
