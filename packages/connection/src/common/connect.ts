import { Deferred } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc/lib/common/connection';

import { NOTREGISTERMETHOD } from './constants';
import { ProxyJSONRPC, ProxyWrapper } from './proxy';
import { ILogger, IRPCServiceMap, RPCServiceMethod } from './types';
import { getMethodName, getServiceMethods } from './utils';

export type ServiceProxy = any;

export enum ServiceType {
  Service,
  Stub,
}

export class RPCServiceStub {
  constructor(private serviceName: string, private center: RPCServiceCenter, private type: ServiceType) {
    if (this.type === ServiceType.Service) {
      this.center.registerService(serviceName, this.type);
    }
  }

  async ready() {
    return this.center.when();
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

  onRequest(name: string, method: RPCServiceMethod) {
    this.center.onRequest(getMethodName(this.serviceName, name), method);
  }

  broadcast(name: string, ...args: any[]): Promise<any> {
    return this.center.broadcast(getMethodName(this.serviceName, name), ...args);
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

interface IBench {
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

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'mock' } : (process as any);

export class RPCServiceCenter {
  public uid: string;

  private proxyWrappers: ProxyWrapper<ProxyJSONRPC>[] = [];

  private connection: Array<MessageConnection> = [];
  private serviceMethodMap = { client: undefined } as unknown as IRPCServiceMap;

  private createService: string[] = [];
  private getService: string[] = [];

  private connectionDeferred = new Deferred<void>();
  private logger: ILogger;

  constructor(private bench?: IBench, logger?: ILogger) {
    this.uid = 'RPCServiceCenter:' + safeProcess.pid;
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
    return this.connectionDeferred.promise;
  }

  setConnection(connection: MessageConnection) {
    if (!this.connection.length) {
      this.connectionDeferred.resolve();
    }
    this.connection.push(connection);

    const rpcProxy = new ProxyJSONRPC(this.serviceMethodMap, this.logger);
    rpcProxy.listen(connection);

    const wrapper = rpcProxy.createProxyWrapper();
    this.proxyWrappers.push(wrapper);
  }

  removeConnection(connection: MessageConnection) {
    const removeIndex = this.connection.indexOf(connection);
    if (removeIndex !== -1) {
      this.connection.splice(removeIndex, 1);
      this.proxyWrappers.splice(removeIndex, 1);
    }

    return removeIndex !== -1;
  }
  onRequest(name: string, method: RPCServiceMethod) {
    if (!this.connection.length) {
      this.serviceMethodMap[name] = method;
    } else {
      this.proxyWrappers.forEach((proxy) => {
        proxy.getOriginal().listenService({ [name]: method });
      });
    }
  }
  async broadcast(name: string, ...args: any[]): Promise<any> {
    const broadcastResult = await Promise.all(this.proxyWrappers.map((proxy) => proxy.getProxy()[name](...args)));
    if (!broadcastResult || broadcastResult.length === 0) {
      throw new Error(`broadcast rpc \`${name}\` error: no remote service can handle this call`);
    }

    const doubtfulResult = [] as any[];
    const result = [] as any[];
    for (const i of broadcastResult) {
      if (i === NOTREGISTERMETHOD) {
        doubtfulResult.push(i);
      } else {
        result.push(i);
      }
    }

    if (doubtfulResult.length > 0) {
      this.logger.warn(`broadcast rpc \`${name}\` getting doubtful responses: ${doubtfulResult.join(',')}`);
    }
    // FIXME: this is an unreasonable design, if remote service only returned doubtful result, we will return an empty array.
    //        but actually we should throw an error to tell user that no remote service can handle this call.
    //        or just return `undefined`.
    return result.length === 1 ? result[0] : result;
  }
}
