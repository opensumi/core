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

// TODO: 开放 serverCenter 方便更多的地方进行服务绑定，例如 terminal 服务
export function createServerConnection2(server: http.Server, handlerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger);
  const serverCenter = new RPCServiceCenter();
  const {
    getRPCService,
    createRPCService,
  } = initRPCService(serverCenter);

  commonChannelPathHandler.register('RPCService', {
      handler: (connection) => {
        logger.log('set rpc connection');
        const serverConnection = createWebSocketConnection(connection);
        connection.messageConnection = serverConnection;
        serverCenter.setConnection(serverConnection);
      },
      dispose: (connection?: any) => {
        // logger.log('remove rpc serverConnection', serverConnection);
        if (connection) {
          serverCenter.removeConnection(connection.messageConnection);
        }
      },
  });

  socketRoute.registerHandler(channelHandler);
  if (handlerArr) {
    for (const handler of handlerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();

  return serverCenter;
  /*
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
  */
}

export async function createNetServerConnection(injector: Injector, modules: NodeModule[], server: net.Server) {

  const serverCenter = new RPCServiceCenter();
  const {
    getRPCService,
    createRPCService,
  } = initRPCService(serverCenter);

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
          const createService = createRPCService(servicePath, serviceInstance);

          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [createService];
          }
        }
      }
    }
  }

}

export async function bindModuleBackService(injector: Injector, modules: NodeModule[], serverCenter: RPCServiceCenter) {

  const {
    createRPCService,
  } = initRPCService(serverCenter);

  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
          logger.log('net back service', service.token);
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
