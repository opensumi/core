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

  forceUseSumi = true;

  constructor(protected repo: ProtocolRepository, public runner: ServiceRunner, channel: WSChannel, logger?: ILogger) {
    this.legacyProxy = new ProxyLegacy(runner, logger);
    this.legacyInvokeProxy = this.legacyProxy.getInvokeProxy();

    this.sumiProxy = new ProxySumi(runner, logger);
    this.sumiInvokeProxy = this.sumiProxy.getInvokeProxy();

    this.listen(channel);
  }

  listen(channel: WSChannel) {
    const messageConnection = channel.createMessageConnection();
    this.legacyProxy.listen(messageConnection);

    const connection = channel.createConnection();
    connection.setProtocolRepository(this.repo);
    this.sumiProxy.listen(connection);
  }

  invoke(name: string, ...args: any[]) {
    if (defaultReservedWordSet.has(name) || typeof name === 'symbol') {
      return Promise.resolve();
    }

    if (this.forceUseSumi) {
      return this.sumiInvokeProxy[name](...args);
    }

    if (this.repo.has(name)) {
      return this.sumiInvokeProxy[name](...args);
    }

    return this.legacyInvokeProxy[name](...args);
  }

  dispose() {
    this.legacyProxy.dispose();
    this.sumiProxy.dispose();
  }
}

export class RPCServiceCenter {
  public uid: string;

  private invokers: Invoker[] = [];

  private protocolRepository = new ProtocolRepository();
  private serviceRunner = new ServiceRunner();

  private readyDeferred = new Deferred<void>();
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
    return this.readyDeferred.promise;
  }

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRepository.loadProtocol(protocol, {
      nameConverter: (name) => getMethodName(protocol.name, name),
    });
  }

  setChannel(channel: WSChannel) {
    if (this.invokers.length === 0) {
      this.readyDeferred.resolve();
    }

    const index = this.invokers.length - 1;

    const invoker = new Invoker(this.protocolRepository, this.serviceRunner, channel, this.logger);
    this.invokers.push(invoker);

    return {
      dispose: () => {
        this.invokers.splice(index, 1);
        invoker.dispose();
      },
    };
  }

  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    this.serviceRunner.register(getMethodName(serviceName, _name), method);
  }

  onRequestService(serviceName: string, service: any) {
    this.serviceRunner.registerService(service, {
      nameConverter: (name) => getMethodName(serviceName, name),
    });
  }

  async broadcast(serviceName: string, _name: string, ...args: any[]): Promise<any> {
    await this.ready();

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
