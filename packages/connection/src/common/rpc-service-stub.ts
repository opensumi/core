import { RPCProtocol, RPCProtocolMethod } from './fury-rpc';
import { RPCServiceCenter } from './rpc-service-center';
import { RPCServiceMethod, ServiceType, formatServiceType } from './types';
import { getServiceMethods } from './utils';

export class RPCServiceStub {
  constructor(private serviceName: string, private center: RPCServiceCenter, private type: ServiceType) {
    if (this.type === ServiceType.Service) {
      this.center.registerService(serviceName, this.type);
    }
  }

  get LOG_TAG() {
    return `[RPCServiceStub] [service-name:${this.serviceName}] [type:${formatServiceType(this.type)}]`;
  }

  async ready() {
    await this.center.when();
  }

  // 服务方
  on(name: string, method: RPCServiceMethod) {
    this.onRequest(name, method);
  }

  onRequestService(service: any) {
    const methods = getServiceMethods(service);
    for (const method of methods) {
      this.onRequest(method, service[method].bind(service));
    }
  }

  loadProtocol(protocol: RPCProtocol) {
    this.center.loadProtocol(protocol);
  }

  onRequestServiceProtocol(service: any, protocol: RPCProtocol) {
    const { name, methods } = protocol;

    const protoMethodMap = Object.create(null) as Record<string, RPCProtocolMethod>;

    for (const m of methods) {
      protoMethodMap[m.method] = m;
    }

    const serviceMethods = getServiceMethods(service);

    this.center.loadProtocol(protocol);

    for (const method of serviceMethods) {
      if (Object.prototype.hasOwnProperty.call(protoMethodMap, method)) {
        this.center.logger.log(this.LOG_TAG, `register service method ${method} in protocol ${name}`);
        this.center.onProtocolRequest(name, method, service[method].bind(service));
      } else {
        this.center.logger.warn(
          this.LOG_TAG,
          `service method ${method} is not defined in protocol ${name}, fallback to normal rpc`,
        );
        this.onRequest(method, service[method].bind(service));
      }
    }
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
        if (target[prop]) {
          return target[prop];
        }
        if (typeof prop === 'symbol') {
          // ?
          return Promise.resolve();
        }
        return (...args: any[]) => this.ready().then(() => this.broadcast(prop, ...args));
      },
    });
}

export function initRPCService<T = void>(center: RPCServiceCenter) {
  return {
    getRPCService: (name: string) => getRPCService<T>(name, center),
    createRPCService: (name: string, service?: any) => {
      const proxy = createRPCService<T>(name, center);
      if (service) {
        proxy.onRequestService(service);
      }

      return proxy;
    },
    createRPCServiceByProtocol(protocol: RPCProtocol, service?: any) {
      const name = protocol.name;
      const proxy = createRPCService<T>(name, center);

      if (service) {
        proxy.onRequestServiceProtocol(service, protocol);
      }

      return proxy;
    },
  };
}

export function createRPCService<T = void>(name: string, center: RPCServiceCenter) {
  return new RPCServiceStub(name, center, ServiceType.Service).getProxy<T>();
}

export function getRPCService<T = void>(name: string, center: RPCServiceCenter) {
  return new RPCServiceStub(name, center, ServiceType.Stub).getProxy<T>();
}
