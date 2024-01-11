import { Deferred, IDisposable } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { METHOD_NOT_REGISTERED } from '../constants';
import { ProxyLegacy } from '../proxy';
import { Invoker } from '../proxy/base';
import { IBench, ILogger, IRPCServiceMap, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'mock' } : (process as any);

export class RPCServiceCenter {
  public uid: string;

  private invokers: Invoker<ProxyLegacy>[] = [];

  private connection: Array<MessageConnection> = [];
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

  setConnection(connection: MessageConnection): IDisposable {
    if (!this.connection.length) {
      this.connectionDeferred.resolve();
    }
    this.connection.push(connection);

    const rpcProxy = new ProxyLegacy(this.serviceMethodMap, this.logger);
    rpcProxy.listen(connection);

    this.invokers.push(rpcProxy.createInvoker());

    return {
      dispose: () => {
        connection.dispose();
        this.removeConnection(connection);
      },
    };
  }

  private removeConnection(connection: MessageConnection) {
    const removeIndex = this.connection.indexOf(connection);
    if (removeIndex !== -1) {
      this.connection.splice(removeIndex, 1);
      this.invokers.splice(removeIndex, 1);
    }

    return removeIndex !== -1;
  }
  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    const name = getMethodName(serviceName, _name);
    if (!this.connection.length) {
      this.serviceMethodMap[name] = method;
    } else {
      this.invokers.forEach((proxy) => {
        proxy.connection.listenService({ [name]: method });
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
