import { RequestHandler } from '@ali/ide-core-node';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import { Injector } from '@ali/common-di';
import { creatRootDirProvider } from '../src/node/file-tree.controller';
import { fileTree } from '../src';

const app = new Koa();
const injector = new Injector([
  creatRootDirProvider(__dirname),
]);
const handler = new RequestHandler([ fileTree ], injector);

app.use(bodyParser());
app.use(async (ctx) => {
  // tslint:disable-next-line
  console.log(ctx.request.body, ctx.request.query);
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
});

const hostname = '127.0.0.1';
const port = 8000;
app.listen(port, hostname, () => {
  // tslint:disable-next-line
  console.log(`Server running at http://${hostname}:${port}/`);
});
