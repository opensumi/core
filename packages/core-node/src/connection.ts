import http from 'http';
import net from 'net';

import { Injector, InstanceCreator, ClassCreator, FactoryCreator } from '@opensumi/di';
import {
  SocketChannel,
  initRPCService,
  RPCServiceCenter,
  RPCService,
  SimpleCommonChannelHandler,
} from '@opensumi/ide-connection';
import { NetSocketDriver } from '@opensumi/ide-connection/lib/common/drivers/socket';
import {
  WebSocketServerRoute,
  WebSocketHandler,
  CommonChannelHandler,
  commonChannelPathHandler,
} from '@opensumi/ide-connection/lib/node';
import { DisposableCollection } from '@opensumi/ide-utils';

import { INodeLogger } from './logger/node-logger';
import { NodeModule } from './node-module';
import { IServerAppOpts } from './types';

export { RPCServiceCenter };

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
    handler: (channel: SocketChannel, clientId: string) => {
      logger.log(`New RPC connection ${clientId}`);

      const serviceCenter = new RPCServiceCenter(undefined, { logger });
      const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter, clientId);

      const serverConnection = channel.createMessageConnection();
      const binaryConnection = channel.createBinaryConnection();

      serviceCenter.setConnection(serverConnection, binaryConnection);

      channel.onClose(() => {
        serviceCenter.removeConnection(serverConnection, binaryConnection);

        serviceChildInjector.disposeAll();
        logger.log(`Remove RPC connection ${clientId}`);
      });
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
  const serviceCenter = new RPCServiceCenter(undefined, { logger });
  const serviceChildInjector = bindModuleBackService(
    injector,
    modulesInstances,
    serviceCenter,
    process.env.CODE_WINDOW_CLIENT_ID as string,
  );

  const channelHandler = new SimpleCommonChannelHandler(process.env.CODE_WINDOW_CLIENT_ID!, logger);

  server.on('connection', (socket) => {
    const disposableCollection = new DisposableCollection();

    const toDispose = channelHandler.handleSocket(new NetSocketDriver(socket).createQueue(), {
      onSocketChannel(socketChannel) {
        const serverConnection = socketChannel.createMessageConnection();
        const binaryConnection = socketChannel.createBinaryConnection();

        serviceCenter.setConnection(serverConnection, binaryConnection);

        disposableCollection.push({
          dispose() {
            serviceCenter.removeConnection(serverConnection, binaryConnection);
          },
        });
      },
      onError(error) {
        //
      },
    });

    socket.on('close', () => {
      toDispose.dispose();
      disposableCollection.dispose();
      serviceChildInjector.disposeAll();
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
  const { createRPCService, createRPCServiceByProtocol } = initRPCService(serviceCenter);

  const childInjector = injector.createChild();
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        const serviceToken = service.token;
        if (!serviceToken || !injector.creatorMap.has(serviceToken)) {
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
          childInjector.addProviders({
            token: serviceToken,
            useClass: (creator as ClassCreator).useClass,
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

    if (module.backServicesWithProtocol) {
      for (const service of module.backServicesWithProtocol) {
        const serviceToken = service.token;
        if (!serviceToken || !injector.creatorMap.has(serviceToken)) {
          continue;
        }

        const protocol = service.protocol;
        if (!protocol) {
          throw new Error(`service ${String(serviceToken)} protocol is undefined`);
        }

        const serviceInstance = childInjector.get(serviceToken) as RPCService;

        if (serviceInstance.setConnectionClientId && clientId) {
          serviceInstance.setConnectionClientId(clientId);
        }

        const stub = createRPCServiceByProtocol(protocol, serviceInstance);

        if (!serviceInstance.rpcClient) {
          serviceInstance.rpcClient = [stub];
        }
      }
    }
  }

  return childInjector;
}
