import http from 'http';
import net from 'net';

import { ClassCreator, FactoryCreator, Injector, InstanceCreator } from '@opensumi/di';
import { RPCServiceCenter, WSChannel, initRPCService } from '@opensumi/ide-connection';
import { CommonChannelPathHandler, RPCServiceChannelPath } from '@opensumi/ide-connection/lib/common/server-handler';
import { ElectronChannelHandler } from '@opensumi/ide-connection/lib/electron';
import { CommonChannelHandler, WebSocketHandler, WebSocketServerRoute } from '@opensumi/ide-connection/lib/node';
import {
  CLIENT_ID_TOKEN,
  RemoteService,
  getRemoteServiceData,
  injectSessionDataStores,
  runInRemoteServiceContext,
} from '@opensumi/ide-core-common';

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
  const serviceChildInjector = bindModuleBackService(injector, modulesInstances, serviceCenter, clientId, logger);

  const remove = serviceCenter.setSumiConnection(channel.createSumiConnection());

  channel.onceClose(() => {
    remove.dispose();
    serviceChildInjector.disposeAll();
    serviceCenter.dispose();

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
  const commonChannelPathHandler = injector.get(CommonChannelPathHandler);
  const socketRoute = new WebSocketServerRoute(server, logger);
  const channelHandler = new CommonChannelHandler('/service', commonChannelPathHandler, logger, {
    pathMatchOptions: serverAppOpts.pathMatchOptions,
    wsServerOptions: serverAppOpts.wsServerOptions,
  });

  // 事件由 connection 的时机来触发
  commonChannelPathHandler.register(RPCServiceChannelPath, {
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
  const commonChannelPathHandler = injector.get(CommonChannelPathHandler);

  const handler = new ElectronChannelHandler(server, commonChannelPathHandler, logger);
  // 事件由 connection 的时机来触发
  commonChannelPathHandler.register(RPCServiceChannelPath, {
    handler: (channel: WSChannel, clientId: string) => {
      handleClientChannel(injector, modulesInstances, channel, clientId, logger);
    },
    dispose: () => {},
  });

  handler.listen();
}

export function bindModuleBackService(
  injector: Injector,
  modules: NodeModule[],
  serviceCenter: RPCServiceCenter,
  clientId: string,
  logger: INodeLogger,
) {
  const { createRPCService } = initRPCService(serviceCenter);
  const childInjector = injector.createChild();

  runInRemoteServiceContext(childInjector, () => {
    injectSessionDataStores(childInjector);
    childInjector.addProviders({
      token: CLIENT_ID_TOKEN,
      useValue: clientId,
    });

    for (const m of modules) {
      if (m.backServices) {
        for (const service of m.backServices) {
          if (!service.token) {
            continue;
          }

          if (service.protocol) {
            serviceCenter.loadProtocol(service.protocol);
          }

          const serviceToken = service.token;

          const creator = injector.creatorMap.get(serviceToken) as InstanceCreator;
          if (!creator) {
            continue;
          }

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

          if (serviceInstance.setConnectionClientId) {
            serviceInstance.setConnectionClientId(clientId);
          }
          const stub = createRPCService(service.servicePath, serviceInstance);
          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [stub];
          }
        }
      }

      if (m.remoteServices) {
        for (const service of m.remoteServices) {
          const serviceInstance = childInjector.get(service);
          const data = getRemoteServiceData(service);
          if (!data || !data.servicePath) {
            logger.error(`Remote service ${RemoteService.getName(service)} must have servicePath`);
            continue;
          }

          if (data.protocol) {
            serviceCenter.loadProtocol(data.protocol);
          }

          if (serviceInstance.setConnectionClientId) {
            serviceInstance.setConnectionClientId(clientId);
          }
          const stub = createRPCService(data.servicePath, serviceInstance);
          if (!serviceInstance.rpcClient) {
            serviceInstance.rpcClient = [stub];
          }
        }
      }
    }
  });

  return childInjector;
}
