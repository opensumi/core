import { Injector, Provider } from '@opensumi/di';
import { RPCServiceCenter, WSChannel, initRPCService } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
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
import { BackService } from '@opensumi/ide-core-common/lib/module';

import { ClientAppStateService } from '../application';
import { createNetSocketConnection, fromWindowClientId } from '../utils';

import { ModuleConstructor } from './app.interface';

const initialLogger = getDebugLogger();

export async function createClientConnection4Web(
  injector: Injector,
  modules: ModuleConstructor[],
  wsPath: UrlProvider,
  onReconnect: () => void,
  protocols?: string[],
  clientId?: string,
) {
  return createConnectionService(
    injector,
    modules,
    onReconnect,
    ReconnectingWebSocketConnection.forURL(wsPath, protocols),
    clientId,
  );
}

export async function createClientConnection4Electron(
  injector: Injector,
  modules: ModuleConstructor[],
  clientId?: string,
) {
  const connection = createNetSocketConnection();
  const channel = WSChannel.forClient(connection, {
    id: clientId || fromWindowClientId('RPCService'),
    logger: console,
  });
  return bindConnectionService(injector, modules, channel);
}

export async function createConnectionService(
  injector: Injector,
  modules: ModuleConstructor[],
  onReconnect: () => void,
  connection: ReconnectingWebSocketConnection | NetSocketConnection,
  clientId?: string,
) {
  const reporterService: IReporterService = injector.get(IReporterService);
  const eventBus = injector.get(IEventBus);
  const stateService = injector.get(ClientAppStateService);

  const channelHandler = new WSChannelHandler(connection, initialLogger, clientId);
  channelHandler.setReporter(reporterService);

  const onOpen = () => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionOpenEvent());
    });
  };

  if (channelHandler.connection.isOpen()) {
    onOpen();
  } else {
    const dispose = channelHandler.connection.onOpen(() => {
      onOpen();
      dispose.dispose();
    });
  }

  channelHandler.connection.onceClose(() => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionCloseEvent());
    });
  });

  channelHandler.connection.onError((e) => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionErrorEvent(e));
    });
  });

  await channelHandler.initHandler();

  injector.addProviders({
    token: WSChannelHandler,
    useValue: channelHandler,
  });

  // 重连不会执行后面的逻辑
  const channel = await channelHandler.openChannel('RPCService');
  channel.onReopen(() => onReconnect());

  bindConnectionService(injector, modules, channel);
}

export async function bindConnectionService(injector: Injector, modules: ModuleConstructor[], channel: WSChannel) {
  const clientCenter = new RPCServiceCenter();
  const dispose = clientCenter.setChannel(channel);

  const toRemove = channel.onClose(() => {
    dispose.dispose();
    toRemove();
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
        if (backService.protocol) {
          clientCenter.loadProtocol(backService.protocol);
        }
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
    if (backService.clientToken) {
      const clientService = injector.get(backService.clientToken);
      rpcService.onRequestService(clientService);
    }
  }
}
