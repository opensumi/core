import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { NodeModule } from './node-module';
import { WebSocketServerRoute, RPCStub, ChannelHandler, WebSocketHandler } from '@ali/ide-connection';
import { Provider, Injector, ClassCreator } from '@ali/common-di';
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
const serviceInjectorMap = new Map();
const clientServerConnectionMap = new Map();
const clientServiceCenterMap = new Map();

export function createServerConnection2(server: http.Server, injector, modulesInstances, handlerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger);

  commonChannelPathHandler.register('RPCService', {
      handler: (connection, clientId: string) => {
        logger.log('set rpc connection');
        const serviceCenter = new RPCServiceCenter();
        const serverConnection = createWebSocketConnection(connection);
        connection.messageConnection = serverConnection;
        serviceCenter.setConnection(serverConnection);

        // 服务链接创建
        const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter);
        serviceInjectorMap.set(clientId, serviceChildInjector);
        clientServerConnectionMap.set(clientId, serverConnection);
        clientServiceCenterMap.set(clientId, serviceCenter);
        console.log('serviceInjectorMap', serviceInjectorMap.keys());
      },
      dispose: (connection: any, connectionClientId: string) => {
        // logger.log('remove rpc serverConnection');
        // if (connection) {
        //   serviceCenter.removeConnection(connection.messageConnection);
        // }

        if (clientServerConnectionMap.has(connectionClientId)) {
          (clientServiceCenterMap.get(connectionClientId) as any).removeConnection(
            clientServerConnectionMap.get(connectionClientId),
          );

          console.log(`${connectionClientId} remove rpc connection`);
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

  // return serviceCenter;
}

export function createNetServerConnection(server: net.Server, injector, modulesInstances) {

  const serviceCenter = new RPCServiceCenter();

  let serverConnection;
  bindModuleBackService(injector, modulesInstances, serviceCenter);
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

  const childInjector = injector.createChild();
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
          logger.log('back service', service.token);
          const serviceToken = service.token;

          if (!injector.creatorMap.get(serviceToken)) {
            return;
          }
          const serviceClass = (injector.creatorMap.get(serviceToken) as ClassCreator).useClass;
          childInjector.addProviders({
            token: serviceToken,
            useClass: serviceClass,
          });
          const serviceInstance = childInjector.get(serviceToken);
          const servicePath = service.servicePath;
          const createService = createRPCService(servicePath, serviceInstance);

          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [createService];
          }
        }
      }
    }
  }

  return childInjector;
}
