import 'tsconfig-paths/register';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as SocketIO from 'socket.io';
import * as http from 'http';
import {WebSocketServerRoute, RPCStub, ChannelHandler} from '@ali/ide-connection';
import { Injector, ConstructorOf, Provider } from '@ali/common-di';
import {createServerConnection} from '@ali/ide-core-node';
import {TerminalHandler} from '@ali/ide-terminal-server';
import {LanguageHandler} from '@ali/ide-language/src/node';
import { getLogger } from '@ali/ide-core-common';

const logger = getLogger();

export async function startServer(modules: any[]) {
  const injector = new Injector();
  // const app = new Koa();
  // app.use(bodyParser());
  // app.use(async (ctx, next) => {
  //   // tslint:disable-next-line
  //   console.log(ctx.request.path, ctx.request.body, ctx.request.query);
  //   ctx.body = 'TODO: Handle request here.';
  // });

  // const hostname = '127.0.0.1';
  const port = 8000;

  const server = http.createServer();
  const terminalHandler = new TerminalHandler(logger);
  const languageHandler = new LanguageHandler();

  createServerConnection(injector, modules, server, [
    terminalHandler, languageHandler,
  ]);
  server.listen(port, () => {
    console.log(`server listen on port ${port}`);
  });

  return server;
}
