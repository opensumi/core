import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as SocketIO from 'socket.io';

export function startServer(modules: any[]) {
  const app = new Koa();
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    // tslint:disable-next-line
    console.log(ctx.request.path, ctx.request.body, ctx.request.query);
    ctx.body = 'TODO: Handle request here.';
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

    socket.on('request', async (id, request) => {
      // tslint:disable-next-line
      console.log('message: ' + JSON.stringify(request));
      const result = 'TODO: Handle request here.';
      const error = null;
      socket.emit('response', id, error, result);
    });
    socket.on('disconnect', () => {
      // tslint:disable-next-line
      console.log('user disconnected');
    });
  });
}
