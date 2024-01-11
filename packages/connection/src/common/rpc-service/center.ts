import { Deferred } from '@opensumi/ide-core-common';

import { METHOD_NOT_REGISTERED } from '../constants';
import { ProxyLegacy } from '../proxy';
import { ProxySumi } from '../proxy/sumi';
import { TSumiProtocol } from '../rpc';
import { ProtocolRepository } from '../rpc/protocol-repository';
import { IBench, ILogger, IRPCServiceMap, RPCServiceMethod, ServiceType } from '../types';
import { getMethodName } from '../utils';
import { WSChannel } from '../ws-channel';

const safeProcess: { pid: string } = typeof process === 'undefined' ? { pid: 'mock' } : (process as any);

const defaultReservedWordSet = new Set(['then']);

class Invoker {
  legacyProxy: ProxyLegacy;
  sumiProxy: ProxySumi;

  private legacyInvokeProxy: any;
  private sumiInvokeProxy: any;

  private protocolRepository: ProtocolRepository;

  setProtocolRepository(protocolRepository: ProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

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
    if (this.protocolRepository.has(name)) {
      return this.sumiInvokeProxy[name](...args);
    }

    return this.legacyInvokeProxy[name](...args);
  }

  register(name: string, method: RPCServiceMethod) {
    const methods = {
      [name]: method,
    };
    if (this.protocolRepository.has(name)) {
      this.sumiProxy.listenService(methods);
      return;
    }

    this.legacyProxy.listenService(methods);
  }
}

export class RPCServiceCenter {
  private protocolRepository = new ProtocolRepository();

  public uid: string;

  private invokers: Invoker[] = [];
  private connection: Array<WSChannel> = [];

  private serviceMethodMap = { client: undefined } as unknown as IRPCServiceMap;
  private serviceMethodWithProtocolMap = { client: undefined } as unknown as IRPCServiceMap;

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
    const messageConnection = channel.createMessageConnection();
    rpcProxy.listen(messageConnection);

    const invoker = new Invoker();

    invoker.setLegacyProxy(rpcProxy);

    const connection = channel.createConnection();
    connection.setProtocolRepository(this.protocolRepository);

    const sumiProxy = new ProxySumi(this.serviceMethodWithProtocolMap, this.logger);
    sumiProxy.listen(connection);

    invoker.setSumiProxy(sumiProxy);

    this.invokers.push(invoker);

    return {
      dispose: () => {
        this.connection.splice(index, 1);
        this.invokers.splice(index, 1);
        messageConnection.dispose();
        connection.dispose();
      },
    };
  }

  loadProtocol(protocol: TSumiProtocol) {
    this.protocolRepository.loadProtocol(protocol);
  }

  onRequest(serviceName: string, _name: string, method: RPCServiceMethod) {
    const name = getMethodName(serviceName, _name);
    if (!this.connection.length) {
      if (this.protocolRepository.has(name)) {
        this.serviceMethodWithProtocolMap[name] = method;
      } else {
        this.serviceMethodMap[name] = method;
      }
    } else {
      this.invokers.forEach((invoker) => {
        invoker.register(name, method);
      });
    }
  }

  async broadcast(serviceName: string, _name: string, ...args: any[]): Promise<any> {
    const name = getMethodName(serviceName, _name);
    const broadcastResult = await Promise.all(this.invokers.map((i) => i.invoke(name, ...args)));

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
