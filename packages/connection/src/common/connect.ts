import { RPCServiceCenter, RPCServiceStub } from './rpc-service';
import { ServiceType } from './types';

export function initRPCService<T = void>(center: RPCServiceCenter) {
  return {
    createRPCService: (name: string, service?: any) => {
      const proxy = createRPCService<T>(name, center);
      if (service) {
        proxy.onRequestService(service);
      }

      return proxy;
    },
    getRPCService: (name: string) => getRPCService<T>(name, center),
  };
}

export function createRPCService<T = void>(name: string, center: RPCServiceCenter) {
  return new RPCServiceStub(name, center, ServiceType.Service).getProxy<T>();
}

export function getRPCService<T = void>(name: string, center: RPCServiceCenter) {
  return new RPCServiceStub(name, center, ServiceType.Stub).getProxy<T>();
}

export * from './rpc-service';
