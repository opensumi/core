import { EventEmitter } from '@opensumi/events';
import {
  CancellationToken,
  CancellationTokenSource,
  DisposableCollection,
  EventQueue,
  IDisposable,
  canceled,
  isPromise,
  parseError,
} from '@opensumi/ide-utils';
import { IReadableStream, isNodeReadable, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { emptyBuffer } from '../buffers/buffers';
import { BaseConnection, NetSocketConnection, WSWebSocketConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';
import { ILogger } from '../types';

import { MethodTimeoutError } from './errors';
import {
  IRequestHeaders,
  IResponseHeaders,
  MessageIO,
  OperationType,
  Status,
  reader,
  requestHeadersSerializer,
  responseHeadersSerializer,
} from './packet';
import { ProtocolRepository } from './protocol-repository';
import {
  TGenericNotificationHandler,
  TGenericRequestHandler,
  TOnNotificationNotFoundHandler,
  TOnRequestNotFoundHandler,
  TRequestCallback,
} from './types';

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

  protected activeRequestPool = new Map<number, ActiveRequest>();

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

      this._callbacks.set(requestId, (headers, error, result) => {
        if (error) {
          if (error === METHOD_NOT_REGISTERED) {
            resolve(error);
            return;
          }

          reject(error);
          return;
        }

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

    try {
      result = handler(...args);
    } catch (err) {
      error = err;
    }

    const onSuccess = (result: any) => {
      if (isNodeReadable(result)) {
        const responseHeaders: IResponseHeaders = {
          chunked: true,
        };
        listenReadable(result, {
          onData: (data) => {
            this.socket.send(MessageIO.Response(requestId, method, responseHeaders, data));
          },
          onEnd: () => {
            this.socket.send(MessageIO.Response(requestId, method, responseHeaders, emptyBuffer));
          },
        });
        return;
      }

      const processor = this.protocolRepository.getProcessor(method);
      const payload = processor.serializeResult(result);
      this.socket.send(MessageIO.Response(requestId, method, nullHeaders, payload));
      this._cancellationTokenSources.delete(requestId);
    };

    const onError = (err: Error) => {
      this.socket.send(MessageIO.Error(requestId, Status.Err, nullHeaders, err));
      this._cancellationTokenSources.delete(requestId);
    };

    if (error) {
      onError(error);
    } else if (isPromise(result)) {
      result.then(onSuccess).catch(onError);
    } else {
      onSuccess(result);
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
      const method = reader.stringOfVarUInt32();

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
          const status = reader.uint16();

          const runCallback = (headers: IResponseHeaders, error?: any, result?: any) => {
            const callback = this._callbacks.get(requestId);
            if (!callback) {
              this.logger.error(`Cannot find callback for request ${requestId}`);
              return;
            }

            this._callbacks.delete(requestId);

            callback(headers, error, result);
          };

          // if status code is not 0, it's an error
          if (status === Status.Err) {
            // TODO: use binary codec
            const content = reader.stringOfVarUInt32();
            const error = parseError(content);
            runCallback(nullHeaders, error);
            return;
          }

          const headers = responseHeadersSerializer.read();
          if (headers && headers.chunked) {
            let activeReq: ActiveRequest;
            if (this.activeRequestPool.has(requestId)) {
              activeReq = this.activeRequestPool.get(requestId)!;
            } else {
              activeReq = new ActiveRequest(requestId, headers);
              this.activeRequestPool.set(requestId, activeReq);
              runCallback(headers, undefined, activeReq);
            }

            const contentLen = reader.varUInt32();

            if (contentLen === 0) {
              activeReq.end();
              this.activeRequestPool.delete(requestId);
              break;
            }

            const buf = reader.bufferRef(contentLen);
            activeReq.emit(buf);
          } else {
            const contentLen = reader.varUInt32();
            const buffer = reader.bufferRef(contentLen);
            const processor = this.protocolRepository.getProcessor(method);

            const result = processor.deserializeResult(buffer);
            runCallback(headers, undefined, result);
          }
          break;
        }
        case OperationType.Notification:
        // fall through
        case OperationType.Request: {
          const headers = requestHeadersSerializer.read() as IRequestHeaders;

          const contentLen = reader.varUInt32();
          const content = reader.bufferRef(contentLen);
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

class ActiveRequest implements IReadableStream<Uint8Array> {
  protected queue = new EventQueue<Uint8Array>();
  protected endQueue = new EventQueue<void>();

  onData(cb: (data: Uint8Array) => void): IDisposable {
    return this.queue.on(cb);
  }

  onEnd(cb: () => void): IDisposable {
    return this.endQueue.on(cb);
  }

  constructor(protected requestId: number, protected responseHeaders: IResponseHeaders) {}

  emit(buffer: Uint8Array) {
    this.queue.push(buffer);
  }

  end() {
    this.queue.dispose();
    this.endQueue.push(undefined);
    this.endQueue.dispose();
  }
}
