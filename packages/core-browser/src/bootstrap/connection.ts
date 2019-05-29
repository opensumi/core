import {StubClient} from '@ali/ide-connection';
import { Injector, Provider, ConstructorOf } from '@ali/common-di';
import { getLogger } from '@ali/ide-core-common';

const logger = getLogger();

export function createClientConnection(injector, modules, wsPath, cb) {
  const clientConnection = new WebSocket(wsPath);
  clientConnection.onopen = async () => {
    const stubClient = new StubClient(clientConnection, logger);
    const backServiceArr: {servicePath: string, clientToken?: ConstructorOf<any>}[] = [];

    logger.log('modules', modules);
    for (const module of modules ) {

      const moduleInstance = injector.get(module);
      if (moduleInstance.backServices) {
        for (const backService of moduleInstance.backServices) {
          const {servicePath, clientToken} = backService;

          backServiceArr.push(backService);
          // if (!backServiceArr.includes(servicePath)) {
          //   backServiceArr.push(servicePath);
          // }
        }
      }
    }
    // FIXME: 目前获取存在覆盖的效果，对于 client 的使用可能是其他 client 提供的通道
    for (const backService of backServiceArr) {
      const {servicePath: backServicePath} = backService;
      const service = await stubClient.getStubService(backServicePath);
      const injectService = {
        token: backServicePath,
        useValue: service,
      } as Provider;
      injector.addProviders(injectService);
    }

    for (const module of modules ) {
      const moduleInstance = injector.get(module);

      if (moduleInstance.frontServices) {
        for (const frontService of moduleInstance.frontServices) {
          const serviceInstance = injector.get(frontService.token);
          stubClient.registerSubClientService(frontService.servicePath, serviceInstance);
        }
      }
    }

    // 待提供的 frontService 对应的对象实例化之后进行 backService 的 client 设置，处理循环依赖
    for (const backService of backServiceArr) {
      const {servicePath: backServicePath, clientToken} = backService;

      logger.log('backServicePath', backServicePath, 'clientToken', clientToken);
      if (clientToken) {
        const proxy = await stubClient.getStubServiceProxy(backServicePath);
        if (proxy) {
          const clientService = injector.get(clientToken);
          proxy.listenService(clientService);
        }
      }
    }

    if (cb) {
     cb();
    }
  };
}
