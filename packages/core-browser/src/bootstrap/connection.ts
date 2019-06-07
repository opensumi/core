import {StubClient} from '@ali/ide-connection';
import { Injector, Provider, ConstructorOf } from '@ali/common-di';
import { ModuleConstructor } from './app';

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
      const backServiceArr: {servicePath: string, clientToken?: ConstructorOf<any>}[] = [];

      for (const module of modules ) {
        const moduleInstance = injector.get(module);
        if (moduleInstance.backServices) {
          for (const backService of moduleInstance.backServices) {

            backServiceArr.push(backService);
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
