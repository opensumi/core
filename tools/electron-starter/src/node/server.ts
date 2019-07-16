console.time('requireTime');
import * as path from 'path';
import * as http from 'http';
import * as Koa from 'koa';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as net from 'net';
import * as yargs from 'yargs';
import { getLogger, ILogger, Deferred, uuid } from '@ali/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';
import { LanguageHandler } from '@ali/ide-language-server';
import { TerminalHandler } from '@ali/ide-terminal-server';
console.timeEnd('requireTime');
console.log(yargs.argv);

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const logger: ILogger = getLogger();
  const app = new Koa();
  const deferred = new Deferred<net.Server>();
  const port = 8000;
  let opts: IServerAppOpts = {
    workspaceDir: path.join(__dirname, '../../../workspace'),
    coreExtensionDir: path.join(__dirname, '../../../core-extensions'),
    webSocketHandler: [
      new TerminalHandler(logger),
      new LanguageHandler(),
    ],
    // TODO 临时方案，传递外层 中间件函数
    use: app.use.bind(app),
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

  const server = net.createServer();
  const listenPath = yargs.argv.listenPath;
  console.log('listenPath', listenPath);

  const serverApp = new ServerApp(opts);

  await serverApp.start(server);

  server.on('error', (err) => {
    deferred.reject(err);
    console.error('server error: ' + err.message);
    setTimeout(process.exit, 0, 1);
  });

  server.listen(listenPath, () => {
    console.log(`server listen on path ${listenPath}`);
    deferred.resolve(server);
  });

    // 给electron-main返回
  // TODO 可能未来用于生命周期控制
  if (process.send) {
    process.send('ready');
  }
  return deferred.promise;
}
