import { Deferred, isDefined } from '@opensumi/ide-core-common';

import { ILogger, IRPCServiceMap } from '../types';
import { ICapturedMessage, MessageType, ResponseStatus, getCapturer } from '../utils';

import type { ServiceRunner } from './runner';

interface IBaseConnection {
  listen(): void;
}

let requestId = 0;

export abstract class ProxyBase<T extends IBaseConnection> {
  protected logger: ILogger;
  protected connection: T;

  protected connectionPromise: Deferred<void> = new Deferred<void>();

  protected abstract engine: 'legacy' | 'sumi';

  constructor(public runner: ServiceRunner, logger?: ILogger) {
    this.logger = logger || console;

    this.runner.onServicesUpdate((services) => {
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
    this.bindMethods(this.runner.getServices());

    connection.listen();
    this.connectionPromise.resolve();
  }

  public listenService(service: IRPCServiceMap) {
    this.runner.registerService(service);
  }

  abstract getInvokeProxy<T = any>(): T;
  protected abstract bindMethods(services: string[]): void;
}
