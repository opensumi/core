import {
  StubClient,

  RPCServiceCenter,
  initRPCService,
  WSChanneHandler,
  createWebSocketConnection,
  createSocketConnection,
  RPCMessageConnection,
 } from '@ali/ide-connection';
import { Injector, Provider, ConstructorOf } from '@ali/common-di';
import { ModuleConstructor } from './app';
import { getLogger } from '@ali/ide-core-common';
import * as net from 'net';

const logger = getLogger();

export async function createClientConnection2(injector: Injector, modules: ModuleConstructor[], wsPath: string, protocols?: string[]) {
  const wsChannelHandler = new WSChanneHandler(wsPath, protocols);
  await wsChannelHandler.initHandler();
  injector.addProviders({
    token: WSChanneHandler,
    useValue: wsChannelHandler,
  });

  // 重连不会执行后面的逻辑
  const channel = await wsChannelHandler.openChannel('RPCService');
  bindConnectionService(injector, modules, createWebSocketConnection(channel));
}

export async function createNetClientConnection(injector: Injector, modules: ModuleConstructor[], connection: any) {
  bindConnectionService(injector, modules, createSocketConnection(connection));
}

export async function bindConnectionService(injector: Injector, modules: ModuleConstructor[], connection: RPCMessageConnection) {
  const clientCenter = new RPCServiceCenter();
  clientCenter.setConnection(connection);

  const {
    getRPCService,
  } = initRPCService(clientCenter);

  const backServiceArr: { servicePath: string, clientToken?: ConstructorOf<any> }[] = [];

  for (const module of modules) {
    const moduleInstance = injector.get(module) as any;
    if (moduleInstance.backServices) {
      for (const backService of moduleInstance.backServices) {
        backServiceArr.push(backService);
      }
    }
  }

  for (const backService of backServiceArr) {
    const { servicePath: backServicePath } = backService;
    const getService = getRPCService(backServicePath);

    const injectService = {
      token: backServicePath,
      useValue: getService,
    } as Provider;

    injector.addProviders(injectService);

    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      getService.onRequestService(clientService);
    }
  }
}
