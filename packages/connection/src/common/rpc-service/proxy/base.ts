import { Deferred } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../../types';
import { ICapturedMessage, MessageType, ResponseStatus, getCapturer } from '../../utils';

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

  protected abstract engine: 'json' | 'sumi';
  capturer: (data: any) => void;

  constructor(public registry: ServiceRegistry, logger?: ILogger) {
    this.logger = logger || console;

    this.capturer = getCapturer();

    this.registry.onServicesUpdate((services) => {
      if (this.connection) {
        this.bindMethods(services);
      }
    });
  }

  // capture messages for opensumi devtools
  private capture(message: ICapturedMessage): void {
    if (this.capturer) {
      this.capturer({
        ...message,
        engine: this.engine,
      });
    }
  }

  protected nextRequestId() {
    return String(requestId++);
  }

  protected captureOnRequest(requestId: string, serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }
    this.capture({ type: MessageType.OnRequest, requestId, serviceMethod, arguments: args });
  }

  protected captureOnRequestResult(requestId: string, serviceMethod: string, data: any): void {
    if (!this.capturer) {
      return;
    }
    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  protected captureOnRequestFail(requestId: string, serviceMethod: string, error: any): void {
    if (!this.capturer) {
      return;
    }

    this.logger.warn(`request exec ${serviceMethod} error`, error);

    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Fail,
      requestId,
      serviceMethod,
      error,
    });
  }

  protected captureOnNotification(serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }
    this.capture({ type: MessageType.OnNotification, serviceMethod, arguments: args });
  }

  protected captureSendRequest(requestId: string, serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }
    this.capture({ type: MessageType.SendRequest, requestId, serviceMethod, arguments: args });
  }

  protected captureSendRequestResult(requestId: string, serviceMethod: string, data: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  protected captureSendRequestFail(requestId: string, serviceMethod: string, error: any): void {
    if (!this.capturer) {
      return;
    }

    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Fail,
      requestId,
      serviceMethod,
      error,
    });
  }

  protected captureSendNotification(serviceMethod: string, args: any[]): void {
    if (!this.capturer) {
      return;
    }
    this.capture({ type: MessageType.SendNotification, serviceMethod, arguments: args });
  }

  listen(connection: T): void {
    this.connection = connection;
    this.bindMethods(this.registry.methods());

    connection.listen();
    this.connectionPromise.resolve();
  }

  public listenService(service: IRPCServiceMap) {
    this.registry.registerService(service);
  }

  dispose(): void {
    if (this.connection) {
      this.connection.dispose();
    }
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
