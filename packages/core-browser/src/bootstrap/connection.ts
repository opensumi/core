import { Injector } from '@opensumi/di';
import { RPCServiceCenter, initRPCService, RPCMessageConnection } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { BinaryConnection } from '@opensumi/ide-connection/lib/common/binary-rpc/connection';
import { createWebSocketConnection } from '@opensumi/ide-connection/lib/common/message';
import {
  getDebugLogger,
  IReporterService,
  BasicModule,
  BrowserConnectionCloseEvent,
  BrowserConnectionOpenEvent,
  BrowserConnectionErrorEvent,
  IEventBus,
  UrlProvider,
} from '@opensumi/ide-core-common';
import { BackService, BackServiceWithProtocol } from '@opensumi/ide-core-common/lib/module';

import { ClientAppStateService } from '../application';

import { ModuleConstructor } from './app.interface';

const initialLogger = getDebugLogger();

export async function createClientConnection2(
  injector: Injector,
  modules: ModuleConstructor[],
  wsPath: UrlProvider,
  onReconnect: () => void,
  protocols?: string[],
  clientId?: string,
) {
  const reporterService: IReporterService = injector.get(IReporterService);
  const eventBus = injector.get(IEventBus);
  const stateService = injector.get(ClientAppStateService);

  const wsChannelHandler = new WSChannelHandler(wsPath, initialLogger, protocols, clientId);
  wsChannelHandler.setReporter(reporterService);
  wsChannelHandler.connection.addEventListener('open', () => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionOpenEvent());
    });
  });

  wsChannelHandler.connection.addEventListener('close', () => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionCloseEvent());
    });
  });

  wsChannelHandler.connection.addEventListener('error', (e) => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionErrorEvent(e));
    });
  });

  await wsChannelHandler.initHandler();

  injector.addProviders({
    token: WSChannelHandler,
    useValue: wsChannelHandler,
  });

  // 重连不会执行后面的逻辑
  const channel = await wsChannelHandler.openChannel('RPCService');
  channel.onReOpen(() => onReconnect());

  bindConnectionService(injector, modules, createWebSocketConnection(channel), channel.createBinaryConnection());
}

export async function bindConnectionService(
  injector: Injector,
  modules: ModuleConstructor[],
  connection: RPCMessageConnection,
  binaryConnection: BinaryConnection,
) {
  const clientCenter = new RPCServiceCenter();
  clientCenter.setConnection(connection);
  clientCenter.setBinaryConnection(binaryConnection);

  connection.onClose(() => {
    clientCenter.removeConnection(connection);
    clientCenter.removeBinaryConnection(binaryConnection);
  });

  const { getRPCService } = initRPCService(clientCenter);

  const backServiceArr: BackService[] = [];
  const backServiceWithProtocolArr: BackServiceWithProtocol[] = [];
  // 存放依赖前端后端服务，后端服务实例化后再去实例化这些 token
  const dependClientBackServices: BackService[] = [];
  const dependClientBackProtocolServices: BackServiceWithProtocol[] = [];

  for (const module of modules) {
    const moduleInstance = injector.get(module) as BasicModule;
    if (moduleInstance.backServices) {
      for (const backService of moduleInstance.backServices) {
        backServiceArr.push(backService);
      }
    }

    if (moduleInstance.backServicesWithProtocol) {
      for (const backService of moduleInstance.backServicesWithProtocol) {
        backServiceWithProtocolArr.push(backService);
      }
    }
  }

  for (const backService of backServiceArr) {
    const { servicePath } = backService;
    const rpcService = getRPCService(servicePath);

    injector.addProviders({
      token: servicePath,
      useValue: rpcService,
    });

    // 这里不进行初始化，先收集依赖，等所有 servicePath 实例化完后在做实例化，防止循环依赖
    if (backService.clientToken) {
      dependClientBackServices.push(backService);
    }
  }

  for (const backService of backServiceWithProtocolArr) {
    const { protocol } = backService;
    const { name } = protocol;
    const rpcService = getRPCService(name);
    rpcService.loadProtocol(protocol);

    injector.addProviders({
      token: name,
      useValue: rpcService,
    });

    if (backService.clientToken) {
      dependClientBackProtocolServices.push(backService);
    }
  }

  for (const backService of dependClientBackServices) {
    const { servicePath } = backService;
    const rpcService = getRPCService(servicePath);
    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      rpcService.onRequestService(clientService);
    }
  }

  // The client service are not implements the protocol
  for (const backService of dependClientBackProtocolServices) {
    const { protocol } = backService;
    const { name } = protocol;
    const rpcService = getRPCService(name);

    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      rpcService.onRequestService(clientService);
    }
  }
}
