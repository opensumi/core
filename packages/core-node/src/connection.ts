import * as http from 'http';
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
          logger.log('back service', service.token.name);
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
          logger.log('back service', service.token.name);

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
