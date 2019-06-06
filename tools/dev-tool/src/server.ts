import 'tsconfig-paths/register';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as SocketIO from 'socket.io';
import * as http from 'http';
import { WebSocketServerRoute, RPCStub, ChannelHandler } from '@ali/ide-connection';
import { Injector, ConstructorOf, Provider } from '@ali/common-di';
import { createServerConnection, NodeModule } from '@ali/ide-core-node';
import { TerminalHandler } from '@ali/ide-terminal-server';
import { getLogger } from '@ali/ide-core-common';
import * as path from 'path';

const logger = getLogger();

export function startServer(modules: NodeModule[]) {
  process.env.WORKSPACE_DIR = path.join(__dirname, '../../workspace');
  const injector = new Injector();
  const app = new Koa();
  // app.use(async (ctx, next) => {
  //   // tslint:disable-next-line
  //   console.log(ctx.request.path, ctx.request.body, ctx.request.query);
  //   ctx.body = 'TODO: Handle request here.';
  // });

  for (const module of modules) {
    if (module.onConfigureServer) {
      module.onConfigureServer(app);
    }
  }
  const port = 8000;

  const server = app.listen(port, () => {
    console.log(`server listen on port ${port}`);
  });

  const terminalHandler = new TerminalHandler(logger);
  createServerConnection(injector, modules, server, [
    terminalHandler,
  ]);

  return server;
}
