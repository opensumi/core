import 'tsconfig-paths/register';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as SocketIO from 'socket.io';
import * as http from 'http';
import {WebSocketServerRoute, RPCStub, ChannelHandler} from '@ali/ide-connection';
import { Injector, ConstructorOf, Provider } from '@ali/common-di';

export async function startServer(modules: any[]) {
  const injector = new Injector();
  const app = new Koa();
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    // tslint:disable-next-line
    console.log(ctx.request.path, ctx.request.body, ctx.request.query);
    ctx.body = 'TODO: Handle request here.';
  });

  // const hostname = '127.0.0.1';
  const port = 8000;

  const server = http.createServer();
  const socketRoute = new WebSocketServerRoute(server);
  const rpcStub = new RPCStub();
  const channelHandler = new ChannelHandler('/service', rpcStub);
  socketRoute.registerHandler(channelHandler);
  socketRoute.init();
  const frontServiceArr: string[] = [];

  for (const module of modules) {
    if (module.providers) {
      injector.addProviders(...module.providers);
    }

    if (module.frontServices) {
      for (const frontService of module.frontServices) {
        const {servicePath} = frontService;
        if (!frontServiceArr.includes(servicePath)) {
          frontServiceArr.push(servicePath);
        }
      }
    }
  }
  for (const frontServicePath of frontServiceArr) {
    const promise = rpcStub.getClientService(frontServicePath);
    const injectService = {
      token: frontServicePath,
      useValue: promise,
    } as Provider;
    injector.addProviders(injectService);
  }
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        console.log('service.token.name', service.token.name);
        const serviceInstance = injector.get(service.token);
        console.log('serviceInstance', serviceInstance);
        rpcStub.registerStubService(service.servicePath, { // TODO: 读取类成员的问题
          resolveContent: serviceInstance.resolveContent.bind(serviceInstance),
        });
      }
    }
  }
  server.listen(port, () => {
    console.log(`server listen on port ${port}`);
  });

  /*
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
  */
}
