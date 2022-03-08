import { MessageConnection } from '@opensumi/vscode-jsonrpc/lib/common/connection';

import { RPCProxy, NOTREGISTERMETHOD } from './proxy';

export type RPCServiceMethod = (...args: any[]) => any;
export type ServiceProxy = any;

export enum ServiceType {
  Service,
  Stub,
}

export class RPCServiceStub {
  constructor(private serviceName: string, private center, private type: ServiceType) {
    if (this.type === ServiceType.Service) {
      this.center.registerService(serviceName, this.type);
    }
  }

  async ready() {
    return this.center.when();
  }
  getNotificationName(name: string) {
    return `on:${this.serviceName}:${name}`;
  }
  getRequestName(name: string) {
    return `${this.serviceName}:${name}`;
  }
  // 服务方
  on(name: string, method: RPCServiceMethod) {
    this.onRequest(name, method);
  }
  getServiceMethod(service): string[] {
    let props: any[] = [];

    if (/^\s*class/.test(service.constructor.toString())) {
      let obj = service;
      do {
        props = props.concat(Object.getOwnPropertyNames(obj));
      } while ((obj = Object.getPrototypeOf(obj)));
      props = props.sort().filter((e, i, arr) => e !== arr[i + 1] && typeof service[e] === 'function');
    } else {
      for (const prop in service) {
        if (service[prop] && typeof service[prop] === 'function') {
          props.push(prop);
        }
      }
    }

    return props;
  }
  onRequestService(service: any) {
    const methods = this.getServiceMethod(service);
    for (const method of methods) {
      this.onRequest(method, service[method].bind(service));
    }
  }

  onRequest(name: string, method: RPCServiceMethod) {
    this.center.onRequest(this.getMethodName(name), method);
  }
  broadcast(name: string, ...args) {
    return this.center.broadcast(this.getMethodName(name), ...args);
  }

  getMethodName(name: string) {
    return name.startsWith('on') ? this.getNotificationName(name) : this.getRequestName(name);
  }
  getProxy = <T>() =>
    new Proxy<RPCServiceStub & T>(this as any, {
      // 调用方
      get: (target, prop: string) => {
        if (!target[prop]) {
          if (typeof prop === 'symbol') {
            return Promise.resolve();
          } else {
            return (...args) =>
              this.ready().then(() => {
                const name = this.getMethodName(prop);
                return Promise.all(this.center.serviceProxy.map((proxy) => proxy[name](...args)))
                  .then((result) => result.filter((res) => res !== NOTREGISTERMETHOD))
                  .then((result) => (result.length === 1 ? result[0] : result));
              });
          }
        } else {
          return target[prop];
        }
      },
    });
}

export function initRPCService<T = void>(center: RPCServiceCenter) {
  return {
    createRPCService: (name: string, service?: any) => {
      const proxy = new RPCServiceStub(name, center, ServiceType.Service).getProxy<T>();
      if (service) {
        proxy.onRequestService(service);
      }

      return proxy;
    },
    getRPCService: (name: string) => new RPCServiceStub(name, center, ServiceType.Stub).getProxy<T>(),
  };
}

interface Ibench {
  registerService: (service: string) => void;
}

export interface RPCMessageConnection extends MessageConnection {
  uid?: string;
  writer?: any;
  reader?: any;
}

export function createRPCService<T = void>(name: string, center: RPCServiceCenter): any {
  return new RPCServiceStub(name, center, ServiceType.Service).getProxy<T>();
}

export function getRPCService<T = void>(name: string, center: RPCServiceCenter): any {
  return new RPCServiceStub(name, center, ServiceType.Stub).getProxy<T>();
}

export class RPCServiceCenter {
  public uid: string;
  public rpcProxy: RPCProxy[] = [];
  public serviceProxy: ServiceProxy[] = [];
  private connection: Array<MessageConnection> = [];
  private serviceMethodMap = { client: undefined };

  private createService: string[] = [];
  private getService: string[] = [];

  private connectionPromise: Promise<void>;
  private connectionPromiseResolve: () => void;
  private logger;

  constructor(private bench?: Ibench, logger?: any) {
    this.uid = 'RPCServiceCenter:' + process.pid;
    this.connectionPromise = new Promise((resolve) => {
      this.connectionPromiseResolve = resolve;
    });
    this.logger = logger || console;
  }

  registerService(serviceName: string, type: ServiceType): void {
    if (type === ServiceType.Service) {
      this.createService.push(serviceName);
      if (this.bench) {
        this.bench.registerService(serviceName);
      }
    } else if (type === ServiceType.Stub) {
      this.getService.push(serviceName);
    }
  }

  when() {
    return this.connectionPromise;
  }

  setConnection(connection: MessageConnection) {
    if (!this.connection.length) {
      this.connectionPromiseResolve();
    }
    this.connection.push(connection);

    const rpcProxy = new RPCProxy(this.serviceMethodMap, this.logger);
    rpcProxy.listen(connection);
    this.rpcProxy.push(rpcProxy);

    const serviceProxy = rpcProxy.createProxy();
    this.serviceProxy.push(serviceProxy);
  }

  removeConnection(connection: MessageConnection) {
    const removeIndex = this.connection.indexOf(connection);
    if (removeIndex !== -1) {
      this.connection.splice(removeIndex, 1);
      this.rpcProxy.splice(removeIndex, 1);
      this.serviceProxy.splice(removeIndex, 1);
    }

    return removeIndex !== -1;
  }
  onRequest(name, method: RPCServiceMethod) {
    if (!this.connection.length) {
      this.serviceMethodMap[name] = method;
    } else {
      this.rpcProxy.forEach((proxy) => {
        proxy.listenService({ [name]: method });
      });
    }
  }
  broadcast(name, ...args): Promise<any> {
    return Promise.all(this.serviceProxy.map((proxy) => proxy[name](...args)) as Promise<any>[])
      .then((result) => result.filter((res) => res !== NOTREGISTERMETHOD))
      .then((result) => (result.length === 1 ? result[0] : result));
  }
}
