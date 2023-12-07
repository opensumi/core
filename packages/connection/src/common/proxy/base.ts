import { Deferred, isDefined } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../types';
import { ICapturedMessage, getCapturer, getServiceMethods } from '../utils';

import { ProxyClient } from './proxy-client';

interface IBaseConnection {
  listen(): void;
}

export abstract class ProxyBase<T extends IBaseConnection, K extends IRPCServiceMap> {
  protected proxyService: any = {};

  protected logger: ILogger;
  protected connection: T;

  protected connectionPromise: Deferred<T> = new Deferred<T>();

  constructor(public target?: K, logger?: ILogger) {
    this.logger = logger || console;
  }

  // capture messages for opensumi devtools
  protected capture(message: ICapturedMessage): void {
    const capturer = getCapturer();
    if (isDefined(capturer)) {
      capturer(message);
    }
  }

  public createProxyClient(): ProxyClient<any> {
    return new ProxyClient(this);
  }

  listen(connection: T): void {
    this.connection = connection;

    if (this.target) {
      this.listenService(this.target);
    }

    this.connectionPromise.resolve(connection);
    connection.listen();
  }

  public listenService(service: K) {
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

  protected abstract bindOnRequest(service: K, cb: (service: K, prop: string) => void): void;
}
