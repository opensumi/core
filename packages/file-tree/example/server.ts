import { RequestHandler } from '@ali/ide-core-node';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as SocketIO from 'socket.io';
import { Injector } from '@ali/common-di';
import * as Http from 'http';
import { creatRootDirProvider } from '../src/node/file-tree.controller';
import { fileTree } from '../src';

const app = new Koa();
const injector = new Injector([
  creatRootDirProvider(__dirname),
]);
const handler = new RequestHandler([ fileTree ], injector);

app.use(bodyParser());
app.use(async (ctx, next) => {
  // tslint:disable-next-line
  console.log(ctx.request.path, ctx.request.body, ctx.request.query);

  if (ctx.request.path.startsWith('/api')) {
    let body: any;
    if (ctx.method.toUpperCase() === 'GET') {
      body = ctx.request.query;
    } else {
      body = ctx.request.body;
    }

    // const body = ctx.request.body || ctx.request.query || {};
    const { fn, result } = await handler.handle(body);

    if (fn) {
      ctx.body = result;
    } else {
      ctx.body = 'Not Found';
      ctx.status = 404;
    }
  } else {
    await next();
  }
});

const hostname = '127.0.0.1';
const port = 8000;
// const server = Http.createServer(app.callback());

const server = app.listen(port, hostname, () => {
  // tslint:disable-next-line
  console.log(`Server running at http://${hostname}:${port}/`);
});

const io = SocketIO(server);
io.on('connection', (socket) => {
  // tslint:disable-next-line
  console.log('connected.');

  socket.on('request', async (id: string, request: any) => {
    // tslint:disable-next-line
    console.log('message: ' + JSON.stringify(request));

    const { fn, result } = await handler.handle(request);
    let error = null;
    if (!fn) {
      error = { status: 404, message: 'Not Found' };
    }
    socket.emit('response', id, error, result);
  });
  socket.on('disconnect', () => {
    // tslint:disable-next-line
    console.log('user disconnected');
  });
});
