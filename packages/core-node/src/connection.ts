import http from 'http';
import net from 'net';

import { Injector, InstanceCreator, ClassCreator, FactoryCreator } from '@opensumi/di';
import {
  WSChannel,
  initRPCService,
  RPCServiceCenter,
  RPCService,
  ChannelMessage,
  parse,
  ConnectionSend,
} from '@opensumi/ide-connection';
import { createWebSocketConnection } from '@opensumi/ide-connection/lib/common/message';
import {
  WebSocketServerRoute,
  WebSocketHandler,
  CommonChannelHandler,
  commonChannelPathHandler,
} from '@opensumi/ide-connection/lib/node';

import { INodeLogger } from './logger/node-logger';
import { NodeModule } from './node-module';
import { IServerAppOpts } from './types';

import { DisposableCollection } from '.';

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
    handler: (connection: WSChannel, clientId: string) => {
      logger.log(`New RPC connection ${clientId}`);

      const serviceCenter = new RPCServiceCenter(undefined, { logger });
      const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter, clientId);

      const serverConnection = createWebSocketConnection(connection);
      const binaryConnection = connection.createBinaryConnection();
      serviceCenter.setConnection(serverConnection);
      serviceCenter.setBinaryConnection(binaryConnection);

      connection.onClose(() => {
        serviceCenter.removeConnection(serverConnection);
        serviceCenter.removeBinaryConnection(binaryConnection);

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

  const clientId = 'node-socket-connection';
  const channelMap = new Map<string, WSChannel>();

  function getOrCreateChannel(channelId: string, connectionSend?: ConnectionSend) {
    let channel = channelMap.get(channelId);
    if (!channel && connectionSend) {
      channel = new WSChannel(connectionSend, clientId);
      channelMap.set(channelId, channel);
    }
    return channel;
  }

  server.on('connection', (socket) => {
    const disposableCollection = new DisposableCollection();

    socket.on('data', (data) => {
      let msgObj: ChannelMessage;

      try {
        msgObj = parse(data);
        if (msgObj.kind === 'open') {
          const channel = getOrCreateChannel(msgObj.id, (content) => {
            socket.write(content);
          })!;

          const messageConnection = channel.createMessageConnection();
          serviceCenter.setConnection(messageConnection);

          const binaryConnection = channel.createBinaryConnection();
          serviceCenter.setBinaryConnection(binaryConnection);

          disposableCollection.push({
            dispose() {
              serviceCenter.removeConnection(messageConnection);
              serviceCenter.removeBinaryConnection(binaryConnection);
            },
          });
        } else if (msgObj.kind === 'data' || msgObj.kind === 'binary') {
          const channel = getOrCreateChannel(msgObj.id);
          if (!channel) {
            logger.error(`channel ${msgObj.id} not found`);
            return;
          }

          channel.handleMessage(msgObj);
        }
      } catch (error) {}
    });

    socket.on('close', () => {
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
