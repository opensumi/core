import { ProxyLegacy } from './legacy';
import { ProxySumi } from './sumi';

const defaultReservedWordSet = new Set(['then', 'finally']);

export class Invoker {
  legacyProxy: ProxyLegacy;
  sumiProxy: ProxySumi;

  private legacyInvokeProxy: any;
  private sumiInvokeProxy: any;

  constructor() {}

  attachLegacy(legacyProxy: ProxyLegacy) {
    this.legacyProxy = legacyProxy;
    this.legacyInvokeProxy = this.legacyProxy.getInvokeProxy();
  }

  attachSumi(sumiProxy: ProxySumi) {
    this.sumiProxy = sumiProxy;
    this.sumiInvokeProxy = this.sumiProxy.getInvokeProxy();
  }

  invoke(name: string, ...args: any[]) {
    if (defaultReservedWordSet.has(name)) {
      return Promise.resolve();
    }

    if (this.sumiInvokeProxy) {
      return this.sumiInvokeProxy[name](...args);
    }

    return this.legacyInvokeProxy[name](...args);
  }

  dispose() {
    if (this.legacyProxy) {
      this.legacyProxy.dispose();
    }
    if (this.sumiProxy) {
      this.sumiProxy.dispose();
    }
  }
}
