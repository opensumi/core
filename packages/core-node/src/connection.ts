import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { NodeModule } from './node-module';
import { WebSocketServerRoute, RPCStub, ChannelHandler, WebSocketHandler } from '@ali/ide-connection';
import { Provider, Injector } from '@ali/common-di';
import { getLogger } from '@ali/ide-core-common';

import {
  CommonChannelHandler,
  commonChannelPathHandler,

  initRPCService,
  RPCServiceCenter,
  createWebSocketConnection,
  createSocketConnection,
} from '@ali/ide-connection';

const logger = getLogger();

export function createServerConnection(injector: Injector, modules: NodeModule[], server: http.Server, handlerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server, logger);
  const rpcStub = new RPCStub();
  const channelHandler = new ChannelHandler('/service', rpcStub, logger);

  socketRoute.registerHandler(channelHandler);
  if (handlerArr) {
    for (const handler of handlerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();
  const frontServiceArr: string[] = [];
  for (const module of modules) {
    if (module.frontServices) {
      for (const frontService of module.frontServices) {
        const { servicePath } = frontService;
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
        if (service.token) {
          logger.log('back service', service.token);
          const serviceInstance = injector.get(service.token);
          rpcStub.registerStubService(service.servicePath, serviceInstance);
        }
      }
    }
  }
}

export function createServerConnection2(injector: Injector, modules: NodeModule[], server: http.Server, handlerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger);
  const serverCenter = new RPCServiceCenter();
  const {
    getRPCService,
    createRPCService,
  } = initRPCService(serverCenter);
  let serverConnection;
  commonChannelPathHandler.register('RPCService', {
      handler: (connection) => {
        logger.log('set rpc connection');
        serverConnection = createWebSocketConnection(connection);
        serverCenter.setConnection(serverConnection);
      },
      dispose: () => {
        serverCenter.removeConnection(serverConnection);
      },
  });

  socketRoute.registerHandler(channelHandler);
  if (handlerArr) {
    for (const handler of handlerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
          logger.log('back service', service.token);

          const serviceInstance = injector.get(service.token);
          const servicePath = service.servicePath;
          const createService = createRPCService(servicePath, serviceInstance);

          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [createService];
          }

        }
      }
    }
  }
}

export async function createNetServerConnection(injector: Injector, modules: NodeModule[]) {
  const server = net.createServer();
  const listenPath = `/Users/franklife/.kt_rpc_sock`; // os.homedir()

  try {
    fs.unlinkSync(listenPath);
  } catch (e) {
    console.log(e);
  }

  const serverCenter = new RPCServiceCenter();
  const {
    getRPCService,
    createRPCService,
  } = initRPCService(serverCenter);

  server.listen(listenPath, () => {
    console.log(`net server listen on ${listenPath}`);
  });
  let serverConnection;

  function createConnectionDispose(connection, serverConnection) {
    connection.on('close', () => {
      serverCenter.removeConnection(serverConnection);
    });
  }
  server.on('connection', (connection) => {
    logger.log(`set net rpc connection`);
    serverConnection = createSocketConnection(connection);
    serverCenter.setConnection(serverConnection);

    createConnectionDispose(connection, serverConnection);
  });

  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
          logger.log('net back service', service.token);

          const serviceInstance = injector.get(service.token);
          const servicePath = service.servicePath;
          const createService = createRPCService(servicePath, service);

          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [createService];
          }
        }
      }
    }
  }

}
