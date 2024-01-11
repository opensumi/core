import { Deferred, isDefined } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../types';
import { ICapturedMessage, getCapturer, getServiceMethods } from '../utils';

interface IBaseConnection {
  listen(): void;
}

export abstract class ProxyBase<T extends IBaseConnection> {
  protected proxyService: any = {};

  protected logger: ILogger;
  protected connection: T;

  protected connectionPromise: Deferred<void> = new Deferred<void>();

  protected abstract engine: 'legacy';

  constructor(public target?: IRPCServiceMap, logger?: ILogger) {
    this.logger = logger || console;
  }

  // capture messages for opensumi devtools
  protected capture(message: ICapturedMessage): void {
    const capturer = getCapturer();
    if (isDefined(capturer)) {
      capturer({
        ...message,
        engine: this.engine,
      });
    }
  }

  public createInvoker(): Invoker<any> {
    return new Invoker(this);
  }

  listen(connection: T): void {
    this.connection = connection;

    if (this.target) {
      this.listenService(this.target);
    }

    connection.listen();
    this.connectionPromise.resolve();
  }

  public listenService(service: IRPCServiceMap) {
    if (this.connection) {
      const proxyService = this.proxyService;
      this.bindOnRequest(service, (service, prop) => {
        proxyService[prop] = service[prop].bind(service);
      });
    } else {
      if (!this.target) {
        this.target = {} as any;
      }
      const target = this.target as any;
      const methods = getServiceMethods(service);
      methods.forEach((method) => {
        // `getServiceMethods` ensure that method is a function
        target[method] = service[method]!.bind(service);
      });
    }
  }

  abstract getInvokeProxy(): any;

  protected abstract bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void;
}

const defaultReservedWordSet = new Set(['then']);

export class Invoker<T extends ProxyBase<any>> {
  public connection: T;
  public proxy: any;
  protected reservedWordSet: Set<string>;

  constructor(connection: T, reservedWords?: string[]) {
    this.connection = connection;
    this.reservedWordSet = new Set(reservedWords) || defaultReservedWordSet;
    const proxy = connection.getInvokeProxy();

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

  invoke(name: string, ...args: any[]) {
    return this.proxy[name](...args);
  }
}
