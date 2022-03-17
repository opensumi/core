import { Injector, Provider } from '@opensumi/di';
import { RPCServiceCenter, initRPCService, RPCMessageConnection } from '@opensumi/ide-connection';
import { WSChannelHandler, createSocketConnection } from '@opensumi/ide-connection/lib/browser';
import { createWebSocketConnection } from '@opensumi/ide-connection/lib/common/message';
import {
  getDebugLogger,
  IReporterService,
  BasicModule,
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  BrowserConnectionErrorEvent,
  IEventBus,
} from '@opensumi/ide-core-common';
import { BackService } from '@opensumi/ide-core-common/lib/module';

import { ClientAppStateService } from '../application';

import { ModuleConstructor } from './app';

// 建立连接之前，无法使用落盘的 logger
// 初始化时使用不落盘的 logger
const initialLogger = getDebugLogger();

export async function createClientConnection2(
  injector: Injector,
  modules: ModuleConstructor[],
  wsPath: string,
  onReconnect: () => void,
  protocols?: string[],
  clientId?: string,
) {
  const reporterService: IReporterService = injector.get(IReporterService);
  const eventBus = injector.get(IEventBus);
  const stateService = injector.get(ClientAppStateService);

  const wsChannelHandler = new WSChannelHandler(wsPath, initialLogger, protocols, clientId);
  wsChannelHandler.setReporter(reporterService);
  wsChannelHandler.connection.addEventListener('open', async () => {
    await stateService.reachedState('core_module_initialized');
    eventBus.fire(new BrowserConnectionOpenEvent());
  });

  wsChannelHandler.connection.addEventListener('close', async () => {
    await stateService.reachedState('core_module_initialized');
    eventBus.fire(new BrowserConnectionCloseEvent());
  });

  wsChannelHandler.connection.addEventListener('error', async (e) => {
    await stateService.reachedState('core_module_initialized');
    eventBus.fire(new BrowserConnectionErrorEvent(e));
  });

  await wsChannelHandler.initHandler();

  injector.addProviders({
    token: WSChannelHandler,
    useValue: wsChannelHandler,
  });
  // 重连不会执行后面的逻辑
  const channel = await wsChannelHandler.openChannel('RPCService');
  channel.onReOpen(() => onReconnect());

  bindConnectionService(injector, modules, createWebSocketConnection(channel));
}

export async function createNetClientConnection(injector: Injector, modules: ModuleConstructor[], connection: any) {
  bindConnectionService(injector, modules, createSocketConnection(connection));
}

export async function bindConnectionService(
  injector: Injector,
  modules: ModuleConstructor[],
  connection: RPCMessageConnection,
) {
  const clientCenter = new RPCServiceCenter();
  clientCenter.setConnection(connection);

  connection.onClose(() => {
    clientCenter.removeConnection(connection);
  });

  const { getRPCService } = initRPCService(clientCenter);

  const backServiceArr: BackService[] = [];
  // 存放依赖前端后端服务，后端服务实例化后再去实例化这些 token
  const dependClientBackServices: BackService[] = [];

  for (const module of modules) {
    const moduleInstance = injector.get(module) as BasicModule;
    if (moduleInstance.backServices) {
      for (const backService of moduleInstance.backServices) {
        backServiceArr.push(backService);
      }
    }
  }

  for (const backService of backServiceArr) {
    const { servicePath } = backService;
    const rpcService = getRPCService(servicePath);

    const injectService = {
      token: servicePath,
      useValue: rpcService,
    } as Provider;

    injector.addProviders(injectService);
    // 这里不进行初始化，先收集依赖，等所有 servicePath 实例化完后在做实例化，防止循环依赖
    if (backService.clientToken) {
      dependClientBackServices.push(backService);
    }
  }

  for (const backService of dependClientBackServices) {
    const { servicePath } = backService;
    const rpcService = getRPCService(servicePath);
    const clientService = injector.get(backService.clientToken!);
    rpcService.onRequestService(clientService);
  }
}
