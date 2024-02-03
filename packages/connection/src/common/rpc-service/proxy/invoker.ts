import { ProtocolRepository } from '../../rpc/protocol-repository';
import { ILogger } from '../../types';
import { WSChannel } from '../../ws-channel';

import { ProxyLegacy } from './legacy';
import { ServiceRegistry } from './registry';
import { ProxySumi } from './sumi';

const defaultReservedWordSet = new Set(['then', 'finally']);

export class Invoker {
  legacyProxy: ProxyLegacy;
  sumiProxy: ProxySumi;

  private legacyInvokeProxy: any;
  private sumiInvokeProxy: any;

  forceUseSumi = true;

  constructor(
    protected repo: ProtocolRepository,
    public registry: ServiceRegistry,
    channel: WSChannel,
    logger?: ILogger,
  ) {
    this.legacyProxy = new ProxyLegacy(registry, logger);
    this.legacyInvokeProxy = this.legacyProxy.getInvokeProxy();

    this.sumiProxy = new ProxySumi(registry, logger);
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
    if (defaultReservedWordSet.has(name)) {
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
