import http from 'http';
import net from 'net';

import ws from 'ws';

import { Injector, InstanceCreator, ClassCreator, FactoryCreator } from '@opensumi/di';
import { WSChannel, initRPCService, RPCServiceCenter } from '@opensumi/ide-connection';
import { createWebSocketConnection } from '@opensumi/ide-connection/lib/common/message';
import {
  WebSocketServerRoute,
  WebSocketHandler,
  CommonChannelHandler,
  commonChannelPathHandler,
  createSocketConnection,
} from '@opensumi/ide-connection/lib/node';


import { INodeLogger } from './logger/node-logger';
import { NodeModule } from './node-module';

export { RPCServiceCenter };

export function createServerConnection2(
  server: http.Server,
  injector,
  modulesInstances,
  handlerArr?: WebSocketHandler[],
) {
  const logger = injector.get(INodeLogger);
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger);

  // 事件由 connection 的时机来触发
  commonChannelPathHandler.register('RPCService', {
    handler: (connection: WSChannel, clientId: string) => {
      logger.log(`set rpc connection ${clientId}`);

      const serviceCenter = new RPCServiceCenter(undefined, logger);
      const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter, clientId);

      const serverConnection = createWebSocketConnection(connection);
      connection.messageConnection = serverConnection;
      serviceCenter.setConnection(serverConnection);

      connection.onClose(() => {
        serviceCenter.removeConnection(serverConnection);
        serviceChildInjector.disposeAll();

        logger.log(`remove rpc connection ${clientId} `);
      });
    },
    dispose: (connection: ws, connectionClientId: string) => {},
  });

  socketRoute.registerHandler(channelHandler);
  if (handlerArr) {
    for (const handler of handlerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();
}

export function createNetServerConnection(server: net.Server, injector, modulesInstances) {
  const logger = injector.get(INodeLogger);
  const serviceCenter = new RPCServiceCenter(undefined, logger);
  const serviceChildInjector = bindModuleBackService(
    injector,
    modulesInstances,
    serviceCenter,
    process.env.CODE_WINDOW_CLIENT_ID as string,
  );

  server.on('connection', (connection) => {
    logger.log('set net rpc connection');
    const serverConnection = createSocketConnection(connection);
    serviceCenter.setConnection(serverConnection);

    connection.on('close', () => {
      serviceCenter.removeConnection(serverConnection);
      serviceChildInjector.disposeAll();

      logger.log('remove net rpc connection');
    });
  });

  return serviceCenter;
}

export function bindModuleBackService(
  injector: Injector,
  modules: NodeModule[],
  serviceCenter: RPCServiceCenter,
  clientId?: string,
) {
  const logger = injector.get(INodeLogger);
  const { createRPCService } = initRPCService(serviceCenter);

  const childInjector = injector.createChild();
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
          logger.log('back service', service.token);
          const serviceToken = service.token;

          if (!injector.creatorMap.has(serviceToken)) {
            continue;
          }

          const creator = injector.creatorMap.get(serviceToken) as InstanceCreator;

          if ((creator as FactoryCreator).useFactory) {
            const serviceFactory = (creator as FactoryCreator).useFactory;
            childInjector.addProviders({
              token: serviceToken,
              useValue: serviceFactory(childInjector),
            });
          } else {
            const serviceClass = (creator as ClassCreator).useClass;
            childInjector.addProviders({
              token: serviceToken,
              useClass: serviceClass,
            });
          }
          const serviceInstance = childInjector.get(serviceToken);

          if (serviceInstance.setConnectionClientId && clientId) {
            serviceInstance.setConnectionClientId(clientId);
          }
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
