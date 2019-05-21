import {StubClient} from '@ali/ide-connection';
import { Injector, Provider } from '@ali/common-di';

export function createClientConnection(injector, modules, wsPath, cb) {
  const clientConnection = new WebSocket(wsPath);
  clientConnection.onopen = async () => {
    const stubClient = new StubClient(clientConnection);
    const backServiceArr: string[] = [];

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
    for (const backServicePath of backServiceArr) {
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

    if (cb) {
     cb();
    }
  };
}
