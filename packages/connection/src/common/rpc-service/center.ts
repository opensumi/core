import { Deferred } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { METHOD_NOT_REGISTERED } from '../constants';
import { ProxyJSONRPC, ProxyWrapper } from '../proxy';
import { IBench, ILogger, IRPCServiceMap, RPCServiceMethod, ServiceType } from '../types';

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
      if (i === METHOD_NOT_REGISTERED) {
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
