import { EventEmitter } from '@opensumi/events';
import {
  DisposableCollection,
  IDisposable,
  Disposable,
  parseError,
  CancellationToken,
  canceled,
  CancellationTokenSource,
  isPromise,
} from '@opensumi/ide-utils';

import { BaseConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';

import {
  BODY_CODEC,
  ERROR_STATUS,
  RPC_TYPE,
  createCancelPacket,
  createErrorResponsePacket,
  createRequestPacket,
  createResponsePacket,
  reader,
} from './packet';
import { ProtocolRepository } from './protocol-repository';
import {
  TGenericNotificationHandler,
  TGenericRequestHandler,
  TOnNotificationNotFoundHandler,
  TOnRequestNotFoundHandler,
  TRequestCallback,
} from './types';

const CancellationTokenStr = '#cancellation.token#';

const assert = (condition: any, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const innerEvents = {
  onRequestNotFound: '##onRequestNotFound',
  onNotificationNotFound: '##onNotificationNotFound',
} as const;

export interface IConnectionOptions {
  timeout?: number;
}

export class Connection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _binaryEmitter = new EventEmitter<{
    [key: string]: [requestId: number, headers: Record<string, any>, args: any[]];
  }>();
  private _notificationEmitter = new EventEmitter<{
    [key: string]: [headers: Record<string, any>, args: any[]];
  }>();

  private _innerEventEmitter = new EventEmitter<{
    [innerEvents.onNotificationNotFound]: [method: string, headers: Record<string, any>, args: any[]];
    [innerEvents.onRequestNotFound]: [requestId: number, method: string, headers: Record<string, any>, args: any[]];
  }>();

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  private readonly _timeoutHandles = new Map<number, NodeJS.Timeout | number>();
  private readonly _cancellationTokenSources = new Map<number, CancellationTokenSource>();
  private readonly _knownCanceledRequests = new Set<number>();

  private protocolRepository: ProtocolRepository;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: IConnectionOptions = {}) {}

  sendNotification(method: string, ...args: any[]) {
    if (!this.protocolRepository.has(method)) {
      throw new MethodProtocolNotFoundError(method);
    }

    const payload = this.protocolRepository.serializeRequest(method, args);
    this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Notification, method, {}, payload));
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      const requestId = this._requestId++;

      this._callbacks.set(requestId, (headers, error, buffer) => {
        if (error) {
          if (error === METHOD_NOT_REGISTERED) {
            resolve(error);
            return;
          }

          reject(error);
          return;
        }

        const result = this.protocolRepository.deserializeResult(method, buffer);
        resolve(result);
      });

      if (!this.protocolRepository.has(method)) {
        throw new MethodProtocolNotFoundError(method);
      }
      const payload = this.protocolRepository.serializeRequest(method, args);

      const cancellationToken: CancellationToken | undefined =
        args.length && CancellationToken.isCancellationToken(args[args.length - 1]) ? args.pop() : undefined;
      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return Promise.reject(canceled());
      }

      if (cancellationToken) {
        args.push(CancellationTokenStr);
        cancellationToken.onCancellationRequested(() => this.cancelRequest(requestId));
      }

      this.socket.send(createRequestPacket(requestId, RPC_TYPE.Request, method, {}, payload));

      // Set timeout callback, -1 means no timeout configuration is set.
      if (this.options.timeout && this.options.timeout !== -1) {
        const timeoutHandle = setTimeout(() => {
          this._handleTimeout(method, requestId);
        }, this.options.timeout);
        this._timeoutHandles.set(requestId, timeoutHandle);
      }
    });
  }

  onNotification(method: string, handler: TGenericNotificationHandler): IDisposable {
    const handlerWrapper = (headers: Record<string, any>, args: any[]) => {
      handler(...args);
    };
    return Disposable.create(this._notificationEmitter.on(method, handlerWrapper));
  }

  onNotificationNotFound(handler: TOnNotificationNotFoundHandler): IDisposable {
    const handlerWrapper = (method: string, headers: Record<string, any>, args: any[]) => {
      handler(method, args);
    };
    return Disposable.create(this._innerEventEmitter.on(innerEvents.onNotificationNotFound, handlerWrapper));
  }

  cancelRequest(requestId: number) {
    this.socket.send(createCancelPacket(requestId));
  }

  private _handleTimeout(method: string, requestId: number) {
    if (!this._callbacks.has(requestId) || !this._timeoutHandles.has(requestId)) {
      return;
    }

    const callback = this._callbacks.get(requestId)!;
    this._callbacks.delete(requestId);
    this._timeoutHandles.delete(requestId);
    callback({}, new MethodTimeoutError(method));
  }

  private runRequestHandler<T extends (...args: any[]) => any>(
    method: string,
    handler: T,
    requestId: number,
    headers: Record<string, any>,
    args: any[],
  ) {
    let result: any;
    let error: Error | undefined;

    try {
      result = handler(...args);
    } catch (err) {
      error = err;
    }

    if (error) {
      this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, {}, error));
      this._cancellationTokenSources.delete(requestId);
    } else if (isPromise(result)) {
      result
        .then((result) => {
          const payload = this.protocolRepository.serializeResult(method, result);
          this.socket.send(createResponsePacket(requestId, {}, payload));
          this._cancellationTokenSources.delete(requestId);
        })
        .catch((err) => {
          this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, {}, err));
          this._cancellationTokenSources.delete(requestId);
        });
    } else {
      const payload = this.protocolRepository.serializeResult(method, result);
      this.socket.send(createResponsePacket(requestId, {}, payload));
      this._cancellationTokenSources.delete(requestId);
    }
  }

  onRequest<T = any>(method: string, handler: TGenericRequestHandler<T>): IDisposable {
    const handlerWrapper = (requestId: number, headers: Record<string, any>, args: any[]) => {
      this.runRequestHandler(method, handler, requestId, headers, args);
    };
    return Disposable.create(this._binaryEmitter.on(method, handlerWrapper));
  }

  onRequestNotFound(handler: TOnRequestNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      this.runRequestHandler(method, handler, requestId, headers, args);
    };

    return Disposable.create(this._innerEventEmitter.on(innerEvents.onRequestNotFound, handlerWrapper));
  }

  setProtocolRepository(protocolRepository: ProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

  listen() {
    const toDispose = this.socket.onMessage((data) => {
      reader.reset(data);
      reader.skip(1);

      const rpcType = reader.uint8();
      const requestId = reader.uint32();
      const codec = reader.uint8();

      switch (rpcType) {
        case RPC_TYPE.Response: {
          const callback = this._callbacks.get(requestId);
          if (!callback) {
            throw new Error(`No callback for request id: ${requestId}`);
          }
          this._callbacks.delete(requestId);

          const status = reader.uint16();
          const headers = readHeaders();

          // if error code is not 0, it's an error
          if (status === ERROR_STATUS.EXEC_ERROR) {
            // 错误信息用 JSON 格式，方便且兼容性好，可恢复成 Error
            assert(codec === BODY_CODEC.JSON, 'Error response should be JSON encoded');
            const content = reader.stringOfVarUInt32();
            const error = parseError(content);
            callback(headers, error);
            return;
          }

          if (codec === BODY_CODEC.Binary) {
            const contentLen = reader.varUInt32();
            const buffer = reader.buffer(contentLen);
            callback(headers, undefined, buffer);
            return;
          }

          const content = reader.stringOfVarUInt32();
          if (codec === BODY_CODEC.JSON) {
            callback(headers, undefined, JSON.parse(content));
          } else {
            callback(headers, undefined, content);
          }
          break;
        }
        case RPC_TYPE.Notification:
        // fall through
        case RPC_TYPE.Request: {
          const method = reader.stringOfVarUInt32();
          const headers = readHeaders();

          const contentLen = reader.varUInt32();
          const content = reader.buffer(contentLen);
          const args = this.protocolRepository.deserializeRequest(method, content);

          this._receiveRequest(rpcType, requestId, method, headers, args);
          break;
        }
        case RPC_TYPE.Cancel: {
          const cancellationTokenSource = this._cancellationTokenSources.get(requestId);
          if (cancellationTokenSource) {
            cancellationTokenSource.cancel();
          } else {
            this._knownCanceledRequests.add(requestId);
          }
          break;
        }
        default: {
          break;
        }
      }

      function readHeaders() {
        const header = reader.stringOfVarUInt32();
        return JSON.parse(header);
      }
    });
    if (toDispose) {
      this.disposable.push(toDispose);
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }

  protected _receiveRequest(
    rpcType: number,
    requestId: number,
    method: string,
    headers: Record<string, any>,
    args: any[],
  ) {
    const hasCancellationToken = args.length && args[args.length - 1] === CancellationTokenStr ? args.pop() : false;
    if (hasCancellationToken) {
      const tokenSource = new CancellationTokenSource();
      this._cancellationTokenSources.set(requestId, tokenSource);
      args.push(tokenSource.token);
      if (this._knownCanceledRequests.has(requestId)) {
        tokenSource.cancel();
        this._knownCanceledRequests.delete(requestId);
      }
    }

    if (rpcType === RPC_TYPE.Request) {
      if (this._binaryEmitter.hasListener(method)) {
        this._binaryEmitter.emit(method, requestId, headers, args);
      } else {
        this._innerEventEmitter.emit(innerEvents.onRequestNotFound, requestId, method, headers, args);
      }
    } else {
      if (this._notificationEmitter.hasListener(method)) {
        this._notificationEmitter.emit(method, headers, args);
      } else {
        this._innerEventEmitter.emit(innerEvents.onNotificationNotFound, method, headers, args);
      }
    }
  }
}

export class MethodProtocolNotFoundError extends Error {
  constructor(method: string) {
    super(`method ${method} not found`);
  }
}

export class MethodTimeoutError extends Error {
  constructor(method: string) {
    super(`method ${method} timeout`);
  }
}
