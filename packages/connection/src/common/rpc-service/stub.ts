import { RPCServiceMethod, ServiceType } from '../types';

import { RPCServiceCenter } from './center';

export class RPCServiceStub {
  constructor(private serviceName: string, private center: RPCServiceCenter, private type: ServiceType) {
    this.center.registerService(serviceName, this.type);
  }

  on(name: string, method: RPCServiceMethod) {
    this.onRequest(name, method);
  }

  onRequestService(service: any) {
    this.center.onRequestService(this.serviceName, service);
  }

  onRequest(name: string, method: RPCServiceMethod) {
    this.center.onRequest(this.serviceName, name, method);
  }

  broadcast(name: string, ...args: any[]): Promise<any> {
    return this.center.broadcast(this.serviceName, name, ...args);
  }

  getProxy = <T>() =>
    new Proxy<T extends void ? RPCServiceStub : RPCServiceStub & T>(this as any, {
      // 调用方
      get: (target, prop: string) => {
        if (typeof prop === 'symbol') {
          return Promise.resolve();
        }

        if (!target[prop]) {
          target[prop] = (...args: any[]) => this.broadcast(prop, ...args);
          return target[prop];
        }

        return target[prop];
      },
    });
}
