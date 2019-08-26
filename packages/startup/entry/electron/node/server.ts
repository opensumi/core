
import * as path from 'path';
import * as net from 'net';
import * as yargs from 'yargs';
import { getLogger, ILogger, Deferred, uuid } from '@ali/ide-core-common';
import { IServerAppOpts, ServerApp, NodeModule } from '@ali/ide-core-node';
import { TerminalHandler } from '@ali/ide-terminal-server';
import {RPCServiceCenter, createSocketConnection} from '@ali/ide-connection';

export async function startServer(arg1: NodeModule[] | Partial<IServerAppOpts>) {
  const logger: ILogger = getLogger();
  const deferred = new Deferred<net.Server>();
  let opts: IServerAppOpts = {
    workspaceDir: path.join(__dirname, '../../../workspace'),
    webSocketHandler: [],
    // TODO 临时方案，传递外层 中间件函数
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

  await deferred.promise;
}
