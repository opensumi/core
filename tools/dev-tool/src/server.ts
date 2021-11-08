import 'tsconfig-paths/register';
import path from 'path';
import http from 'http';
import Koa from 'koa';
import { Deferred } from '@ali/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const app = new Koa();
  const deferred = new Deferred<http.Server>();
  const port = process.env.IDE_SERVER_PORT || 8000;
  let opts: IServerAppOpts = {
    webSocketHandler: [
      // new TerminalHandler(logger),
    ],
    use: app.use.bind(app),
    marketplace: {
      showBuiltinExtensions: true,
      accountId: 'nGJBcqs1D-ma32P3mBftgsfq',
      masterKey: '-nzxLbuqvrKh8arE0grj2f1H',
    },
    processCloseExitThreshold: 5 * 60 * 1000,
    terminalPtyCloseThreshold: 5 * 60 * 1000,
    staticAllowOrigin: '*',
    staticAllowPath: [
      path.join(__dirname, '../../../packages/kaitian-extension'),
      '/',
    ],
    extLogServiceClassPath: path.join(__dirname, './mock-log-service.js'),
    /**
     * 集成时可使用自定义的 extHost 入口传入内置 command
     *  extHost: path.join(__dirname, './ext-host.js') || process.env.EXTENSION_HOST_ENTRY,
     */
    extHost: path.join(__dirname, '../../../packages/kaitian-extension/lib/hosted/ext.process.js') || process.env.EXTENSION_HOST_ENTRY,
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
