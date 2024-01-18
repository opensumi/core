import { Deferred } from '@opensumi/ide-core-common';

import { METHOD_NOT_REGISTERED } from '../constants';
import { ProxyLegacy } from '../proxy';
import { ServiceRunner } from '../proxy/runner';
import { ProxySumi } from '../proxy/sumi';
import { TSumiProtocol } from '../rpc';
import { ProtocolRepository } from '../rpc/protocol-repository';
import { IBench, ILogger, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';
import { WSChannel } from '../ws-channel';

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'mock' } : (process as any);

const defaultReservedWordSet = new Set(['then']);

class Invoker {
  legacyProxy: ProxyLegacy;
  sumiProxy: ProxySumi;

  private legacyInvokeProxy: any;
  private sumiInvokeProxy: any;

  constructor(protected repo: ProtocolRepository) {}

  setLegacyProxy(proxy: ProxyLegacy) {
    this.legacyProxy = proxy;
    this.legacyInvokeProxy = proxy.getInvokeProxy();
  }

  setSumiProxy(proxy: ProxySumi) {
    this.sumiProxy = proxy;
    this.sumiInvokeProxy = proxy.getInvokeProxy();
  }

  invoke(name: string, ...args: any[]) {
    if (defaultReservedWordSet.has(name) || typeof name === 'symbol') {
      return Promise.resolve();
    }

    if (this.repo.has(name)) {
      return this.sumiInvokeProxy[name](...args);
    }

    return this.legacyInvokeProxy[name](...args);
  }
}

export class RPCServiceCenter {
  public uid: string;

  private invokers: Invoker[] = [];
  private connection: Array<WSChannel> = [];

  private protocolRepository = new ProtocolRepository();
  private serviceRunner = new ServiceRunner();

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

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRepository.loadProtocol(protocol);
  }

  setChannel(channel: WSChannel) {
    if (this.connection.length === 0) {
      this.connectionDeferred.resolve();
    }

    this.connection.push(channel);
    const index = this.connection.length - 1;

    const invoker = new Invoker(this.protocolRepository);

    const rpcProxy = new ProxyLegacy(this.serviceRunner, this.logger);
    const messageConnection = channel.createMessageConnection();
    rpcProxy.listen(messageConnection);

    const sumiRPC = new ProxySumi(this.serviceRunner, this.logger);
    const connection = channel.createConnection();
    sumiRPC.listen(connection);

    invoker.setLegacyProxy(rpcProxy);
    invoker.setSumiProxy(sumiRPC);

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
    this.serviceRunner.register(name, method);
  }

  onRequestService(serviceName: string, service: any) {
    this.serviceRunner.registerService(service, {
      nameConverter: (name) => getMethodName(serviceName, name),
    });
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
