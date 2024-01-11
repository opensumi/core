import { Deferred } from '@opensumi/ide-core-common';

import { METHOD_NOT_REGISTERED } from '../constants';
import { ProxyLegacy } from '../proxy';
import { IBench, ILogger, IRPCServiceMap, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';
import { WSChannel } from '../ws-channel';

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'mock' } : (process as any);

const defaultReservedWordSet = new Set(['then']);

class Invoker {
  legacyProxy: ProxyLegacy;

  private legacyInvokeProxy: any;

  setLegacyProxy(proxy: ProxyLegacy) {
    this.legacyProxy = proxy;
    this.legacyInvokeProxy = proxy.getInvokeProxy();
  }

  invoke(name: string, ...args: any[]) {
    if (defaultReservedWordSet.has(name) || typeof name === 'symbol') {
      return Promise.resolve();
    }

    return this.legacyInvokeProxy[name](...args);
  }
}

export class RPCServiceCenter {
  public uid: string;

  private invokers: Invoker[] = [];
  private connection: Array<WSChannel> = [];

  private serviceMethodMap = { client: undefined } as unknown as IRPCServiceMap;

  private connectionDeferred = new Deferred<void>();
  private logger: ILogger;

  constructor(private bench?: IBench, logger?: ILogger) {
    this.uid = 'RPCServiceCenter:' + safeProcess.pid;
    this.logger = logger || console;
  }

  registerService(serviceName: string, type: ServiceType): void {
    if (type === ServiceType.Service) {
      if (this.bench) {
        this.bench.registerService(serviceName);
      }
    }
  }

  ready() {
    return this.connectionDeferred.promise;
  }

  setChannel(channel: WSChannel) {
    if (!this.connection.length) {
      this.connectionDeferred.resolve();
    }
    this.connection.push(channel);
    const index = this.connection.length - 1;

    const rpcProxy = new ProxyLegacy(this.serviceMethodMap, this.logger);
    const connection = channel.createMessageConnection();
    rpcProxy.listen(connection);

    const invoker = new Invoker();

    invoker.setLegacyProxy(rpcProxy);

    this.invokers.push(invoker);

    return {
      dispose: () => {
        this.connection.splice(index, 1);
        this.invokers.splice(index, 1);
        connection.dispose();
      },
    };
  }

  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    const name = getMethodName(serviceName, _name);
    if (!this.connection.length) {
      this.serviceMethodMap[name] = method;
    } else {
      this.invokers.forEach((proxy) => {
        proxy.legacyProxy.listenService({ [name]: method });
      });
    }
  }

  async broadcast(serviceName: string, _name: string, ...args: any[]): Promise<any> {
    const name = getMethodName(serviceName, _name);
    const broadcastResult = await Promise.all(this.invokers.map((proxy) => proxy.invoke(name, ...args)));

    const doubtfulResult = [] as any[];
    const result = [] as any[];
    for (const i of broadcastResult) {
      if (i === METHOD_NOT_REGISTERED) {
        doubtfulResult.push(i);
      } else {
        result.push(i);
      }
    }

    if (doubtfulResult.length > 0) {
      this.logger.warn(`broadcast rpc \`${name}\` getting doubtful responses: ${doubtfulResult.join(',')}`);
    }

    if (result.length === 0) {
      throw new Error(`broadcast rpc \`${name}\` error: no remote service can handle this call`);
    }

    // FIXME: this is an unreasonable design, if remote service only returned doubtful result, we will return an empty array.
    //        but actually we should throw an error to tell user that no remote service can handle this call.
    //        or just return `undefined`.
    return result.length === 1 ? result[0] : result;
  }
}
