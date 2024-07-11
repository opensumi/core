import { Injector, Provider } from '@opensumi/di';
import { RPCServiceCenter, initRPCService } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { ISumiConnectionOptions } from '@opensumi/ide-connection/lib/common/rpc/connection';
import { RPCServiceChannelPath } from '@opensumi/ide-connection/lib/common/server-handler';
import {
  BasicModule,
  BrowserConnectionCloseEvent,
  BrowserConnectionErrorEvent,
  BrowserConnectionOpenEvent,
  IEventBus,
  ILogger,
  IReporterService,
} from '@opensumi/ide-core-common';
import { BackService } from '@opensumi/ide-core-common/lib/module';

import { ClientAppStateService } from '../application';
import { Logger } from '../logger';
import { AppConfig } from '../react-providers/config-provider';

import { ModuleConstructor } from './app.interface';

import type { MessageConnection } from '@opensumi/vscode-jsonrpc/lib/common/connection';

export async function createConnectionService(
  injector: Injector,
  modules: ModuleConstructor[],
  channelHandler: WSChannelHandler,
  options: ISumiConnectionOptions = {},
) {
  const appConfig = injector.get(AppConfig) as AppConfig;
  const reporterService: IReporterService = injector.get(IReporterService);
  channelHandler.setReporter(reporterService);

  const eventBus = injector.get(IEventBus);
  const stateService = injector.get(ClientAppStateService);

  const onOpen = () => {
    stateService.reachedState('core_module_initialized').then(() => {
      eventBus.fire(new BrowserConnectionOpenEvent());
    });
  };

  if (channelHandler.connection.isOpen()) {
    onOpen();
  }

  // reconnecting will still emit the open event
  channelHandler.connection.onOpen(() => {
    onOpen();
  });

  channelHandler.connection.onClose(() => {
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

  const channel = await channelHandler.openChannel(RPCServiceChannelPath);

  const clientCenter = new RPCServiceCenter();
  clientCenter.setSumiConnection(channel.createSumiConnection(options));

  if (appConfig?.measure?.connection) {
    clientCenter.setReporter(reporterService, appConfig.measure.connection.minimumReportThresholdTime);
  }

  initConnectionService(injector, modules, clientCenter);

  // report log to server after connection established
  const logger = injector.get(ILogger) as Logger;
  logger.reportToServer();

  return channel;
}

/**
 * @deprecated Please use `bindConnectionService` instead
 */
export function bindConnectionServiceDeprecated(
  injector: Injector,
  modules: ModuleConstructor[],
  connection: MessageConnection,
) {
  const clientCenter = new RPCServiceCenter();
  const dispose = clientCenter.setConnection(connection);

  const toDispose = connection.onClose(() => {
    dispose.dispose();
    toDispose.dispose();
  });

  initConnectionService(injector, modules, clientCenter);
}

function initConnectionService(injector: Injector, modules: ModuleConstructor[], clientCenter: RPCServiceCenter) {
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
