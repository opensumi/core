import { Deferred, DisposableStore } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../../types';

import type { ServiceRegistry } from '../registry';

interface IBaseConnection {
  listen(): void;
  dispose(): void;
}

const defaultReservedWordSet = new Set(['then', 'finally']);

let requestId = 0;

export abstract class ProxyBase<T extends IBaseConnection> {
  protected logger: ILogger;
  protected connection: T;

  protected connectionPromise: Deferred<void> = new Deferred<void>();

  protected _disposables = new DisposableStore();

  protected abstract engine: 'json' | 'sumi';

  constructor(public registry: ServiceRegistry, logger?: ILogger) {
    this.logger = logger || console;

    this.registry.onServicesUpdate((services) => {
      if (this.connection) {
        this.bindMethods(services);
      }
    });
  }

  protected nextRequestId() {
    return String(requestId++);
  }

  listen(connection: T): void {
    this.connection = connection;
    this._disposables.add(this.connection);
    this.bindMethods(this.registry.methods());

    connection.listen();
    this.connectionPromise.resolve();
  }

  public listenService(service: IRPCServiceMap) {
    this.registry.registerService(service);
  }

  dispose(): void {
    this._disposables.dispose();
  }

  public abstract invoke(prop: string, ...args: any[]): Promise<any>;
  protected abstract bindMethods(services: PropertyKey[]): void;

  public getInvokeProxy<T = any>(): T {
    return new Proxy(Object.create(null), {
      get: (target: any, p: PropertyKey) => {
        if (typeof p !== 'string') {
          return null;
        }
        if (defaultReservedWordSet.has(p)) {
          return Promise.resolve();
        }

        if (!target[p]) {
          target[p] = (...args: any[]) => this.invoke(p, ...args);
        }
        return target[p];
      },
    });
  }
}
