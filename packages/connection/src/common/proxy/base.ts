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
      this.bindOnRequest(service, (service, prop) => {
        this.proxyService[prop] = service[prop].bind(service);
      });
    } else {
      if (!this.target) {
        this.target = {} as any;
      }

      const methods = getServiceMethods(service);
      for (const method of methods) {
        // `getServiceMethods` ensure that method is a function
        (this.target as any)[method] = service[method]!.bind(service);
      }
    }
  }

  abstract getInvokeProxy(): any;

  protected abstract bindOnRequest(service: IRPCServiceMap, cb: (service: IRPCServiceMap, prop: string) => void): void;
}
