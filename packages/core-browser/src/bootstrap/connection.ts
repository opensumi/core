import {
  StubClient,

  RPCServiceCenter,
  initRPCService,
  WSChanneHandler,
  createWebSocketConnection,
 } from '@ali/ide-connection';
import { Injector, Provider, ConstructorOf } from '@ali/common-di';
import { ModuleConstructor } from './app';
import { getLogger } from '@ali/ide-core-common';

const logger = getLogger();

/**
 * 创建连接，注册后端服务
 * @param injector 全局唯一的 injector
 * @param modules 后端 module
 * @param wsPath websocket 地址
 */
export async function createClientConnection(injector: Injector, modules: ModuleConstructor[], wsPath: string) {
  const clientConnection = new WebSocket(wsPath);
  return new Promise((resolve) => {
    clientConnection.onopen = async () => {
      const stubClient = new StubClient(clientConnection);
      const backServiceArr: { servicePath: string, clientToken?: ConstructorOf<any> }[] = [];

      logger.log('modules', modules);
      for (const module of modules) {

        const moduleInstance = injector.get(module) as any;
        if (moduleInstance.backServices) {
          for (const backService of moduleInstance.backServices) {
            backServiceArr.push(backService);
          }
        }
      }
      // FIXME: 目前获取存在覆盖的效果，对于 client 的使用可能是其他 client 提供的通道
      for (const backService of backServiceArr) {
        const { servicePath: backServicePath } = backService;
        const service = await stubClient.getStubService(backServicePath);
        const injectService = {
          token: backServicePath,
          useValue: service,
        } as Provider;
        injector.addProviders(injectService);
      }

      for (const module of modules) {
        const moduleInstance = injector.get(module) as any;

        if (moduleInstance.frontServices) {
          for (const frontService of moduleInstance.frontServices) {
            const serviceInstance = injector.get(frontService.token);
            stubClient.registerSubClientService(frontService.servicePath, serviceInstance);
          }
        }
      }

      // 待提供的 frontService 对应的对象实例化之后进行 backService 的 client 设置，处理循环依赖
      for (const backService of backServiceArr) {
        const { servicePath: backServicePath, clientToken } = backService;

        logger.log('backServicePath', backServicePath, 'clientToken', clientToken);
        if (clientToken) {
          const proxy = await stubClient.getStubServiceProxy(backServicePath);
          if (proxy) {
            const clientService = injector.get(clientToken);
            proxy.listenService(clientService);
          }
        }
      }
      resolve();
    };
  });
}

export async function createClientConnection2(injector: Injector, modules: ModuleConstructor[], wsPath: string) {
  const wsChannelHandler = new WSChanneHandler(wsPath);
  await wsChannelHandler.initHandler();

  const channel = await wsChannelHandler.openChannel('RPCService');

  const clientCenter = new RPCServiceCenter();
  clientCenter.setConnection(createWebSocketConnection(channel));

  const {
    getRPCService,
    createRPCService,
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
