import { Deferred, isDefined } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../../types';
import { ICapturedMessage, MessageType, ResponseStatus, getCapturer } from '../../utils';

import type { ServiceRegistry } from './registry';

interface IBaseConnection {
  listen(): void;
  dispose(): void;
}

let requestId = 0;

export abstract class ProxyBase<T extends IBaseConnection> {
  protected logger: ILogger;
  protected connection: T;

  protected connectionPromise: Deferred<void> = new Deferred<void>();

  protected abstract engine: 'legacy' | 'sumi';

  constructor(public registry: ServiceRegistry, logger?: ILogger) {
    this.logger = logger || console;

    this.registry.onServicesUpdate((services) => {
      if (this.connection) {
        this.bindMethods(services);
      }
    });
  }

  // capture messages for opensumi devtools
  private capture(message: ICapturedMessage): void {
    const capturer = getCapturer();
    if (isDefined(capturer)) {
      capturer({
        ...message,
        engine: this.engine,
      });
    }
  }

  protected nextRequestId() {
    return String(requestId++);
  }

  protected captureOnRequest(requestId: string, serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.OnRequest, requestId, serviceMethod, arguments: args });
  }

  protected captureOnRequestResult(requestId: string, serviceMethod: string, data: any): void {
    this.capture({
      type: MessageType.OnRequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  protected captureOnRequestFail(requestId: string, serviceMethod: string, error: any): void {
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
    this.capture({ type: MessageType.OnNotification, serviceMethod, arguments: args });
  }

  protected captureSendRequest(requestId: string, serviceMethod: string, args: any[]): void {
    this.capture({ type: MessageType.SendRequest, requestId, serviceMethod, arguments: args });
  }

  protected captureSendRequestResult(requestId: string, serviceMethod: string, data: any): void {
    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Success,
      requestId,
      serviceMethod,
      data,
    });
  }

  protected captureSendRequestFail(requestId: string, serviceMethod: string, error: any): void {
    this.capture({
      type: MessageType.RequestResult,
      status: ResponseStatus.Fail,
      requestId,
      serviceMethod,
      error,
    });
  }

  protected captureSendNotification(serviceMethod: string, args: any[]): void {
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

  abstract getInvokeProxy<T = any>(): T;
  protected abstract bindMethods(services: PropertyKey[]): void;
}
