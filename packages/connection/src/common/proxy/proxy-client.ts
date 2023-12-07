import { ProxyBase } from './base';

const defaultReservedWordSet = new Set(['then']);

export class ProxyClient<T extends ProxyBase<any, any>> {
  protected original: T;
  protected proxy: any;
  protected reservedWordSet: Set<string>;

  constructor(original: T, reservedWords?: string[]) {
    this.original = original;
    this.reservedWordSet = new Set(reservedWords) || defaultReservedWordSet;
    const proxy = original.getInvokeProxy();

    this.proxy = new Proxy(
      {},
      {
        get: (target, prop: string | symbol) => {
          if (this.reservedWordSet.has(prop as string) || typeof prop === 'symbol') {
            return Promise.resolve();
          } else {
            return proxy[prop];
          }
        },
      },
    );
  }

  public getOriginal(): T {
    return this.original;
  }

  public getProxy<K extends object>(): K {
    return this.proxy;
  }
}
