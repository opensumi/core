import { EventEmitter } from '@opensumi/events';
import {
  CancellationToken,
  CancellationTokenSource,
  DisposableCollection,
  IDisposable,
  canceled,
  isPromise,
  parseError,
} from '@opensumi/ide-utils';

import { BaseConnection, NetSocketConnection, WSWebSocketConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';
import { ILogger } from '../types';

import { MethodTimeoutError } from './errors';
import {
  BodyCodec,
  ErrorCode,
  IRequestHeaders,
  MessageIO,
  OperationType,
  reader,
  requestHeadersSerializer,
} from './packet';
import { ProtocolRepository } from './protocol-repository';
import {
  TGenericNotificationHandler,
  TGenericRequestHandler,
  TOnNotificationNotFoundHandler,
  TOnRequestNotFoundHandler,
  TRequestCallback,
} from './types';
import { assert } from './utils';

import type net from 'net';
import type { WebSocket } from 'ws';

const nullHeaders = {};

const star = '*';

export interface ISumiConnectionOptions {
  timeout?: number;
  logger?: ILogger;
}

export class SumiConnection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _requestEmitter = new EventEmitter<{
    [key: string]: [requestId: number, method: string, headers: Record<string, any>, args: any[]];
  }>();
  private _notificationEmitter = new EventEmitter<{
    [key: string]: [requestId: number, method: string, headers: Record<string, any>, args: any[]];
  }>();

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  private readonly _timeoutHandles = new Map<number, NodeJS.Timeout | number>();
  private readonly _cancellationTokenSources = new Map<number, CancellationTokenSource>();
  private readonly _knownCanceledRequests = new Set<number>();

  public protocolRepository = new ProtocolRepository();
  protected logger: ILogger = console;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiConnectionOptions = {}) {
    if (options.logger) {
      this.logger = options.logger;
    }
  }

  sendNotification(method: string, ...args: any[]) {
    const processor = this.protocolRepository.getProcessor(method);
    const payload = processor.serializeRequest(args);
    this.socket.send(MessageIO.Request(this._requestId++, OperationType.Notification, method, nullHeaders, payload));
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      const requestId = this._requestId++;

      const processor = this.protocolRepository.getProcessor(method);

      this._callbacks.set(requestId, (headers, error, buffer) => {
        if (error) {
          if (error === METHOD_NOT_REGISTERED) {
            resolve(error);
            return;
          }

          reject(error);
          return;
        }

        const result = processor.deserializeResult(buffer);
        resolve(result);
      });

      // Set timeout callback, -1 means no timeout configuration is set.
      if (this.options.timeout && this.options.timeout !== -1) {
        const timeoutHandle = setTimeout(() => {
          this._handleTimeout(method, requestId);
        }, this.options.timeout);
        this._timeoutHandles.set(requestId, timeoutHandle);
      }

      const cancellationToken: CancellationToken | undefined =
        args.length && CancellationToken.isCancellationToken(args[args.length - 1]) ? args.pop() : undefined;
      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return Promise.reject(canceled());
      }

      if (cancellationToken) {
        cancellationToken.onCancellationRequested(() => this.cancelRequest(requestId));
      }

      const payload = processor.serializeRequest(args);
      this.socket.send(
        MessageIO.Request(
          requestId,
          OperationType.Request,
          method,
          {
            cancelable: cancellationToken ? true : false,
          },
          payload,
        ),
      );
    });
  }

  onNotification(method: string, handler: TGenericNotificationHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      handler(...args);
    };
    return this._notificationEmitter.on(method, handlerWrapper);
  }

  onNotificationNotFound(handler: TOnNotificationNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      handler(method, args);
    };
    return this._notificationEmitter.on(star, handlerWrapper);
  }

  cancelRequest(requestId: number) {
    this.socket.send(MessageIO.Cancel(requestId));
  }

  private _handleTimeout(method: string, requestId: number) {
    if (!this._callbacks.has(requestId) || !this._timeoutHandles.has(requestId)) {
      return;
    }

    const callback = this._callbacks.get(requestId)!;
    this._callbacks.delete(requestId);
    this._timeoutHandles.delete(requestId);
    callback(nullHeaders, new MethodTimeoutError(method));
  }

  private runRequestHandler<T extends (...args: any[]) => any>(
    requestId: number,
    method: string,
    args: any[],
    handler: T,
  ) {
    let result: any;
    let error: Error | undefined;
    const processor = this.protocolRepository.getProcessor(method);

    try {
      result = handler(...args);
    } catch (err) {
      error = err;
    }

    if (error) {
      this.socket.send(MessageIO.Error(requestId, ErrorCode.Err, nullHeaders, error));
      this._cancellationTokenSources.delete(requestId);
    } else if (isPromise(result)) {
      result
        .then((result) => {
          const payload = processor.serializeResult(result);
          this.socket.send(MessageIO.Response(requestId, nullHeaders, payload));
          this._cancellationTokenSources.delete(requestId);
        })
        .catch((err) => {
          this.socket.send(MessageIO.Error(requestId, ErrorCode.Err, nullHeaders, err));
          this._cancellationTokenSources.delete(requestId);
        });
    } else {
      const payload = processor.serializeResult(result);
      this.socket.send(MessageIO.Response(requestId, nullHeaders, payload));
      this._cancellationTokenSources.delete(requestId);
    }
  }

  onRequest<T = any>(method: string, handler: TGenericRequestHandler<T>): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      this.runRequestHandler(requestId, method, args, handler);
    };
    return this._requestEmitter.on(method, handlerWrapper);
  }

  onRequestNotFound(handler: TOnRequestNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      this.runRequestHandler(requestId, method, [method, args], handler);
    };

    return this._requestEmitter.on(star, handlerWrapper);
  }

  setProtocolRepository(protocolRepository: ProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

  listen() {
    const toDispose = this.socket.onMessage((data) => {
      reader.reset(data);
      // skip version, currently only have version 1
      reader.skip(1);

      const rpcType = reader.uint8();

      const requestId = reader.uint32();
      const codec = reader.uint8();

      if (this._timeoutHandles.has(requestId)) {
        // Ignore some jest test scenarios where clearTimeout is not defined.
        if (typeof clearTimeout === 'function') {
          // @ts-ignore
          clearTimeout(this._timeoutHandles.get(requestId));
        }
        this._timeoutHandles.delete(requestId);
      }

      switch (rpcType) {
        case OperationType.Response: {
          const callback = this._callbacks.get(requestId);
          if (!callback) {
            this.logger.error(`Cannot find callback for request ${requestId}`);
            return;
          }

          this._callbacks.delete(requestId);

          const status = reader.uint16();
          // const headers = headerSerializer.read();

          // if error code is not 0, it's an error
          if (status === ErrorCode.Err) {
            // TODO: use binary codec
            assert(codec === BodyCodec.JSON, 'Error response should be JSON encoded');
            const content = reader.stringOfVarUInt32();
            const error = parseError(content);
            callback(nullHeaders, error);
            return;
          }

          if (codec === BodyCodec.Binary) {
            const contentLen = reader.varUInt32();
            const buffer = reader.buffer(contentLen);
            callback(nullHeaders, undefined, buffer);
            return;
          }

          const content = reader.stringOfVarUInt32();
          if (codec === BodyCodec.JSON) {
            callback(nullHeaders, undefined, JSON.parse(content));
          } else {
            callback(nullHeaders, undefined, content);
          }
          break;
        }
        case OperationType.Notification:
        // fall through
        case OperationType.Request: {
          const method = reader.stringOfVarUInt32();
          const headers = requestHeadersSerializer.read() as IRequestHeaders;

          const contentLen = reader.varUInt32();
          const content = reader.buffer(contentLen);
          const processor = this.protocolRepository.getProcessor(method);

          const args = processor.deserializeRequest(content);

          this._receiveRequest(rpcType, requestId, method, headers, args);
          break;
        }
        case OperationType.Cancel: {
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
    });
    if (toDispose) {
      this.disposable.push(toDispose);
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }

  protected _receiveRequest(rpcType: number, requestId: number, method: string, headers: IRequestHeaders, args: any[]) {
    const cancelable = headers.cancelable;
    if (cancelable) {
      const tokenSource = new CancellationTokenSource();
      this._cancellationTokenSources.set(requestId, tokenSource);
      args.push(tokenSource.token);

      if (this._knownCanceledRequests.has(requestId)) {
        tokenSource.cancel();
        this._knownCanceledRequests.delete(requestId);
      }
    }

    if (rpcType === OperationType.Request) {
      const eventName = this._requestEmitter.hasListener(method) ? method : star;
      this._requestEmitter.emit(eventName, requestId, method, headers, args);
    } else {
      const eventName = this._notificationEmitter.hasListener(method) ? method : star;
      this._notificationEmitter.emit(eventName, requestId, method, headers, args);
    }
  }

  static forWSWebSocket(socket: WebSocket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new WSWebSocketConnection(socket), options);
  }

  static forNetSocket(socket: net.Socket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new NetSocketConnection(socket), options);
  }
}
