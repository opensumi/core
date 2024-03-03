import { Deferred } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { METHOD_NOT_REGISTERED } from '../constants';
import { TSumiProtocol } from '../rpc';
import { SumiConnection } from '../rpc/connection';
import { IBench, ILogger, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';

import { ProtocolRegistry, ProxyJson, ProxySumi, ServiceRegistry } from './proxy';
import { ProxyBase } from './proxy/base';

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'unknown' } : (process as any);

export class RPCServiceCenter {
  public uid: string;

  private proxies: ProxyBase<any>[] = [];

  private registry = new ServiceRegistry();
  private protocolRegistry = new ProtocolRegistry();

  private deferred = new Deferred<void>();
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
    return this.deferred.promise;
  }

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRegistry.addProtocol(protocol, {
      nameConverter: (name) => getMethodName(protocol.name, name),
    });
  }

  setSumiConnection(connection: SumiConnection) {
    if (this.proxies.length === 0) {
      this.deferred.resolve();
    }

    this.protocolRegistry.apply(connection.protocolRepository);

    const index = this.proxies.length - 1;
    const sumiProxy = new ProxySumi(this.registry, this.logger);
    sumiProxy.listen(connection);

    this.proxies.push(sumiProxy);

    return {
      dispose: () => {
        this.proxies.splice(index, 1);
        sumiProxy.dispose();
      },
    };
  }

  setConnection(connection: MessageConnection) {
    if (this.proxies.length === 0) {
      this.deferred.resolve();
    }

    const index = this.proxies.length - 1;

    const jsonProxy = new ProxyJson(this.registry, this.logger);
    jsonProxy.listen(connection);

    this.proxies.push(jsonProxy);

    return {
      dispose: () => {
        this.proxies.splice(index, 1);
        jsonProxy.dispose();
      },
    };
  }

  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    this.registry.register(getMethodName(serviceName, _name), method);
  }

  onRequestService(serviceName: string, service: any) {
    this.registry.registerService(service, {
      nameConverter: (name) => getMethodName(serviceName, name),
    });
  }

  async broadcast(serviceName: string, _name: string, ...args: any[]): Promise<any> {
    await this.ready();

    const name = getMethodName(serviceName, _name);
    const broadcastResult = await Promise.all(this.proxies.map((proxy) => proxy.invoke(name, ...args)));

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
    // but actually we should throw an error to tell user that no remote service can handle this call.
    // or just return `undefined`.
    return result.length === 1 ? result[0] : result;
  }
}
