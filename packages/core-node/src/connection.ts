import http from 'http';
import net from 'net';

import { Injector, InstanceCreator, ClassCreator, FactoryCreator } from '@opensumi/di';
import { WSChannel, initRPCService, RPCServiceCenter } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import {
  WebSocketServerRoute,
  WebSocketHandler,
  CommonChannelHandler,
  commonChannelPathHandler,
} from '@opensumi/ide-connection/lib/node';

import { INodeLogger } from './logger/node-logger';
import { NodeModule } from './node-module';
import { IServerAppOpts } from './types';

export { RPCServiceCenter };

function handleClientChannel(
  injector: Injector,
  modulesInstances: NodeModule[],
  channel: WSChannel,
  clientId: string,
  logger: INodeLogger,
) {
  logger.log(`New RPC connection ${clientId}`);

  const serviceCenter = new RPCServiceCenter(undefined, logger);
  const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter, clientId);

  const remove = serviceCenter.setConnection(channel.createMessageConnection());

  channel.onClose(() => {
    remove.dispose();
    serviceChildInjector.disposeAll();

    logger.log(`Remove RPC connection ${clientId}`);
  });
}

export function createServerConnection2(
  server: http.Server,
  injector: Injector,
  modulesInstances: NodeModule[],
  handlerArr: WebSocketHandler[],
  serverAppOpts: IServerAppOpts,
) {
  const logger = injector.get(INodeLogger);
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', logger, {
    pathMatchOptions: serverAppOpts.pathMatchOptions,
    wsServerOptions: serverAppOpts.wsServerOptions,
  });

  // 事件由 connection 的时机来触发
  commonChannelPathHandler.register('RPCService', {
    handler: (channel: WSChannel, clientId: string) => {
      handleClientChannel(injector, modulesInstances, channel, clientId, logger);
    },
    dispose: () => {},
  });

  socketRoute.registerHandler(channelHandler);
  if (handlerArr) {
    for (const handler of handlerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();
}

export function createNetServerConnection(server: net.Server, injector: Injector, modulesInstances: NodeModule[]) {
  const logger = injector.get(INodeLogger) as INodeLogger;

  server.on('connection', (socket) => {
    logger.log('new connection', socket.remoteAddress, socket.remotePort);
    const channel = WSChannel.forClient(new NetSocketConnection(socket), {
      id: process.env.CODE_WINDOW_CLIENT_ID!,
      tag: 'node-server',
      logger,
    });
    handleClientChannel(injector, modulesInstances, channel, process.env.CODE_WINDOW_CLIENT_ID!, logger);
  });
}

export function bindModuleBackService(
  injector: Injector,
  modules: NodeModule[],
  serviceCenter: RPCServiceCenter,
  clientId?: string,
) {
  const { createRPCService } = initRPCService(serviceCenter);

  const childInjector = injector.createChild();
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        if (service.token) {
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
