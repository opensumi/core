import {
  createMessageConnection,

  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,

  MessageConnection,

} from '@ali/vscode-jsonrpc';

export {
  SocketMessageReader,
  SocketMessageWriter,

  WebSocketMessageReader,
  WebSocketMessageWriter,
};
import {
  RPCProxy,
  RPCService as IRPCService,
  NOTREGISTERMETHOD,
} from './proxy';
import * as net from 'net';
import * as ws from 'ws';

export type RPCServiceMethod = (...args: any[]) => any;
export type ServiceProxy = any;

export enum ServiceType {
  Service,
  Stub,
}

export function initRPCService(center: RPCServiceCenter) {
  return {
    createRPCService: (name: string, service?: any): any => {
      const proxy = new RPCServiceStub(name, center, ServiceType.Service).getProxy();
      if (service) {
        proxy.onRequestService(service);
      }

      return proxy;
    },
    getRPCService: (name: string): any => {
      return new RPCServiceStub(name, center,  ServiceType.Stub).getProxy();
    },
  };
}

export function createRPCService(name: string, center: RPCServiceCenter): any {
  return new RPCServiceStub(name, center, ServiceType.Service).getProxy();
}

export function getRPCService(name: string, center: RPCServiceCenter): any {
  return new RPCServiceStub(name, center,  ServiceType.Stub).getProxy();
}

interface Ibench {
  registerService: (service: string) => void;
}

interface RPCMessageConnection extends MessageConnection {
  uid?: string;
  writer?: any;
  reader?: any;
}

export class RPCServiceCenter {
  public uid: string;
  public rpcProxy: RPCProxy[] = [];
  public serviceProxy: ServiceProxy[] = [];
  private connection: MessageConnection[] = [];
  private serviceMethodMap = {};

  private createService: string[] = [];
  private getService: string[] = [];

  private connectionPromise: Promise<void>;
  private connectionPromiseResolve: () => void;

  constructor(private bench?: Ibench) {
    this.uid = 'RPCServiceCenter:' + process.pid;
    this.connectionPromise = new Promise((resolve) => {
      this.connectionPromiseResolve = resolve;
    });
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
  setConnection(connection: RPCMessageConnection) {
    if (!this.connection.length) {
      this.connectionPromiseResolve();
    }
    this.connection.push(connection);

    const rpcProxy = new RPCProxy(this.serviceMethodMap);
    rpcProxy.listen(connection);
    this.rpcProxy.push(rpcProxy);

    const serviceProxy = rpcProxy.createProxy();
    this.serviceProxy.push(serviceProxy);

  }
  removeConnection(connection: RPCMessageConnection) {
    const removeIndex = this.connection.indexOf(connection);
    if ( removeIndex !== -1) {
      this.connection.splice(removeIndex, 1);
      this.rpcProxy.splice(removeIndex, 1);
      this.serviceProxy.splice(removeIndex, 1);
    }

  }
  onRequest(name, method: RPCServiceMethod) {
    if (!this.connection.length) {
      this.serviceMethodMap[name] = method;
    } else {
      this.rpcProxy.forEach((proxy) => {
        proxy.listenService({[name]: method});
      });
    }
  }
  broadcast(name, ...args): Promise<any> {
    return Promise.all(this.serviceProxy.map((proxy) => {
      return proxy[name](...args);
    }) as Promise<any>[]).then((result) => {
      return result.filter((res) => res !== NOTREGISTERMETHOD);
    }).then((result) => {
      return result.length === 1 ? result[0] : result;
    });
  }
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
  getNotificationName(name) {
    return `on:${this.serviceName}:${name}`;
  }
  getRequestName(name) {
    return `${this.serviceName}:${name}`;
  }
  // 服务方
  on(name, method: RPCServiceMethod) {
    this.onRequest(name, method);
  }
  getServiceMethod(service): string[] {
    let props: any[] = [];

    if (/^\s*class/.test(service.constructor.toString())) {
      let obj = service;
      do {
          props = props.concat(Object.getOwnPropertyNames(obj));
      } while (obj = Object.getPrototypeOf(obj));
      props = props.sort().filter((e, i, arr) => {
        return e !== arr[i + 1] && typeof service[e] === 'function';
      });
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
  onRequest(name, method: RPCServiceMethod) {
    this.center.onRequest(this.getMethodName(name), method);
  }
  broadcast(name, ...args) {
    return this.center.broadcast(this.getMethodName(name), ...args);
  }

  getMethodName(name) {
    return name.startsWith('on') ? this.getNotificationName(name) : this.getRequestName(name);
  }
  getProxy = () => {
    return new Proxy(this, {
      // 调用方
      get: (target, prop: string) => {
        if (!target[prop]) {
          if (typeof prop === 'symbol') {
            return Promise.resolve();
          } else {
            return (...args) => {
              return this.ready().then(() => {
                const name = this.getMethodName(prop);
                return Promise.all(this.center.serviceProxy.map((proxy) => {
                  return proxy[name](...args);
                })).then((result) => {
                  return result.filter((res) => res !== NOTREGISTERMETHOD);
                }).then((result) => {
                  return result.length === 1 ? result[0] : result;
                });
              });
            };
          }
        } else {
          return target[prop];
        }
      },
    });
  }
}

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(
    new SocketMessageReader(socket),
    new SocketMessageWriter(socket),
  );
}

export function createWebSocketConnection(socket: any) {
  return createMessageConnection(
    new WebSocketMessageReader(socket),
    new WebSocketMessageWriter(socket),
  );
}
