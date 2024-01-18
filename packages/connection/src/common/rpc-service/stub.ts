import { RPCServiceMethod, ServiceType } from '../types';

import { RPCServiceCenter } from './center';

export class RPCServiceStub {
  constructor(private serviceName: string, private center: RPCServiceCenter, private type: ServiceType) {
    this.center.registerService(serviceName, this.type);
  }

  async ready() {
    return this.center.ready();
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
        if (!target[prop]) {
          if (typeof prop === 'symbol') {
            return Promise.resolve();
          } else {
            return (...args: any[]) => this.ready().then(() => this.broadcast(prop, ...args));
          }
        } else {
          return target[prop];
        }
      },
    });
}
