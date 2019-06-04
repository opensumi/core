import {StubClient} from '@ali/ide-connection';
import { Injector, Provider } from '@ali/common-di';
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
      const backServiceArr: string[] = [];

      // 收集浏览器环境使用的后端服务
      for (const module of modules ) {
        const moduleInstance = injector.get(module);
        if (moduleInstance.backServices) {
          for (const backService of moduleInstance.backServices) {
            const {servicePath} = backService;
            if (!backServiceArr.includes(servicePath)) {
              backServiceArr.push(servicePath);
            }
          }
        }
      }

      // 连接后端 channel
      for (const backServicePath of backServiceArr) {
        const service = await stubClient.getStubService(backServicePath);
        const injectService = {
          token: backServicePath,
          useValue: service,
        } as Provider;
        injector.addProviders(injectService);
      }

      // 注册前端服务
      for (const module of modules ) {
        const moduleInstance = injector.get(module);

        if (moduleInstance.frontServices) {
          for (const frontService of moduleInstance.frontServices) {
            const serviceInstance = injector.get(frontService.token);
            stubClient.registerSubClientService(frontService.servicePath, serviceInstance);
          }
        }
      }
      resolve();
    };
  });
}
