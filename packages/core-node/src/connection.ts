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

export {RPCServiceCenter};

const logger = getLogger();

export function createServerConnection2(server: http.Server, handlerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger);
  const serviceCenter = new RPCServiceCenter();

  commonChannelPathHandler.register('RPCService', {
      handler: (connection) => {
        logger.log('set rpc connection');
        const serverConnection = createWebSocketConnection(connection);
        connection.messageConnection = serverConnection;
        serviceCenter.setConnection(serverConnection);
      },
      dispose: (connection?: any) => {
        // logger.log('remove rpc serverConnection', serverConnection);
        if (connection) {
          serviceCenter.removeConnection(connection.messageConnection);
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

  return serviceCenter;
}

export function createNetServerConnection(server: net.Server) {

  const serviceCenter = new RPCServiceCenter();

  let serverConnection;

  function createConnectionDispose(connection, serverConnection) {
    connection.on('close', () => {
      serviceCenter.removeConnection(serverConnection);
    });
  }
  server.on('connection', (connection) => {
    logger.log(`set net rpc connection`);
    serverConnection = createSocketConnection(connection);
    serviceCenter.setConnection(serverConnection);

    createConnectionDispose(connection, serverConnection);
  });

  return serviceCenter;

}

export function bindModuleBackService(injector: Injector, modules: NodeModule[], serviceCenter: RPCServiceCenter) {

  const {
    createRPCService,
  } = initRPCService(serviceCenter);

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
