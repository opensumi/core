import {WebSocketServerRoute, RPCStub, ChannelHandler, WebSocketHandler} from '@ali/ide-connection';
import { Injector, Provider } from '@ali/common-di';

export function createServerConnection(injector, modules, server, handerArr?: WebSocketHandler[]) {
  const socketRoute = new WebSocketServerRoute(server);
  const rpcStub = new RPCStub();
  const channelHandler = new ChannelHandler('/service', rpcStub);

  socketRoute.registerHandler(channelHandler);

  if (handerArr) {
    for (const handler of handerArr) {
      socketRoute.registerHandler(handler);
    }
  }
  socketRoute.init();
  const frontServiceArr: string[] = [];

  for (const module of modules) {
    if (module.providers) {
      injector.addProviders(...module.providers);
    }

    if (module.frontServices) {
      for (const frontService of module.frontServices) {
        const {servicePath} = frontService;
        if (!frontServiceArr.includes(servicePath)) {
          frontServiceArr.push(servicePath);
        }
      }
    }
  }
  for (const frontServicePath of frontServiceArr) {
    const promise = rpcStub.getClientService(frontServicePath);
    const injectService = {
      token: frontServicePath,
      useValue: promise,
    } as Provider;
    injector.addProviders(injectService);
  }
  for (const module of modules) {
    if (module.backServices) {
      for (const service of module.backServices) {
        console.log('back service', service.token.name);
        const serviceInstance = injector.get(service.token);
        rpcStub.registerStubService(service.servicePath, serviceInstance);
      }
    }
  }
}
