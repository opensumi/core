import { getDebugLogger } from '@opensumi/ide-core-common';
import {
  CancellationToken,
  CancellationTokenSource,
  DisposableCollection,
  EventQueue,
  IDisposable,
  canceled,
  parseError,
} from '@opensumi/ide-utils';
import { IReadableStream, isReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { BaseConnection, NetSocketConnection, WSWebSocketConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';
import { ILogger } from '../types';

import { MethodTimeoutError } from './errors';
import { MessageIO, OperationType, Status } from './message-io';
import {
  IRequestHeaders,
  IResponseHeaders,
  TGenericNotificationHandler,
  TGenericRequestHandler,
  TNotificationNotFoundHandler,
  TRequestCallback,
  TRequestNotFoundHandler,
} from './types';

import type net from 'net';
import type { WebSocket } from 'ws';

const nullHeaders = {};

export interface ISumiConnectionOptions {
  timeout?: number;
  logger?: ILogger;
}

export class SumiConnection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _requestHandlers = new Map<string, TGenericRequestHandler<any>>();
  private _starRequestHandler: TRequestNotFoundHandler | undefined;
  private _notificationHandlers = new Map<string, TGenericNotificationHandler>();
  private _starNotificationHandler: TNotificationNotFoundHandler | undefined;

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  private readonly _timeoutHandles = new Map<number, NodeJS.Timeout | number>();
  private readonly _cancellationTokenSources = new Map<number, CancellationTokenSource>();
  private readonly _knownCanceledRequests = new Set<number>();

  protected activeRequestPool = new Map<number, ActiveRequest>();

  public io = new MessageIO();
  protected logger: ILogger;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiConnectionOptions = {}) {
    if (options.logger) {
      this.logger = options.logger;
    } else {
      this.logger = getDebugLogger();
    }
  }

  sendNotification(method: string, ...args: any[]) {
    this.socket.send(this.io.Notification(this._requestId++, method, nullHeaders, args));
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      const requestId = this._requestId++;

      this._callbacks.set(requestId, (headers, error, result) => {
        if (error) {
          if (error === METHOD_NOT_REGISTERED) {
            // we should not treat `METHOD_NOT_REGISTERED` as an error.
            // it is a special case, it means the method is not registered on the other side.
            resolve(error);
            return;
          }

          this.traceRequestError(method, args, error);
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

      this.socket.send(
        this.io.Request(
          requestId,
          method,
          {
            cancelable: Boolean(cancellationToken) || undefined,
          },
          args,
        ),
      );
    });
  }

  cancelRequest(requestId: number) {
    this.socket.send(this.io.Cancel(requestId));
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

  onRequest<T = any>(method: string, handler: TGenericRequestHandler<T>): IDisposable {
    this._requestHandlers.set(method, handler);
    return {
      dispose: () => {
        this._requestHandlers.delete(method);
      },
    };
  }

  onRequestNotFound(handler: TRequestNotFoundHandler): IDisposable {
    this._starRequestHandler = handler;
    return {
      dispose: () => {
        this._starRequestHandler = undefined;
      },
    };
  }

  onNotification(method: string, handler: TGenericNotificationHandler): IDisposable {
    this._notificationHandlers.set(method, handler);
    return {
      dispose: () => {
        this._notificationHandlers.delete(method);
      },
    };
  }

  onNotificationNotFound(handler: TNotificationNotFoundHandler): IDisposable {
    this._starNotificationHandler = handler;
    return {
      dispose: () => {
        this._starNotificationHandler = undefined;
      },
    };
  }

  listen() {
    const { reader } = this.io;

    const toDispose = this.socket.onMessage((data) => {
      reader.reset(data);
      // skip version, currently only have version 1
      reader.skip(1);

      const opType = reader.uint8() as OperationType;
      const requestId = reader.uint32();

      if (this._timeoutHandles.has(requestId)) {
        // Ignore some jest test scenarios where clearTimeout is not defined.
        if (typeof clearTimeout === 'function') {
          // @ts-ignore
          clearTimeout(this._timeoutHandles.get(requestId));
        }
        this._timeoutHandles.delete(requestId);
      }

      switch (opType) {
        case OperationType.Response: {
          const method = reader.stringOfVarUInt32();
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

          const headers = this.io.responseHeadersSerializer.read();

          switch (status) {
            case Status.Err: {
              // TODO: use binary codec
              const content = reader.stringOfVarUInt32();
              const error = parseError(content);
              runCallback(nullHeaders, error);
              break;
            }
            default: {
              if (headers && headers.chunked) {
                let activeReq: ActiveRequest;
                if (this.activeRequestPool.has(requestId)) {
                  activeReq = this.activeRequestPool.get(requestId)!;
                } else {
                  activeReq = new ActiveRequest(requestId, headers);
                  this.activeRequestPool.set(requestId, activeReq);
                  runCallback(headers, undefined, activeReq);
                }

                const result = this.io.getProcessor(method).readResponse() as Uint8Array;

                // when result is null, it means the stream is ended.
                if (result) {
                  activeReq.emit(result);
                  break;
                }

                activeReq.end();
                this.activeRequestPool.delete(requestId);
              } else {
                const result = this.io.getProcessor(method).readResponse();
                runCallback(headers, undefined, result);
              }
            }
          }
          break;
        }
        case OperationType.Notification:
        // fall through
        case OperationType.Request: {
          const method = reader.stringOfVarUInt32();
          const headers = this.io.requestHeadersSerializer.read() as IRequestHeaders;
          const args = this.io.getProcessor(method).readRequest();

          if (headers.cancelable) {
            const tokenSource = new CancellationTokenSource();
            this._cancellationTokenSources.set(requestId, tokenSource);
            args.push(tokenSource.token);

            if (this._knownCanceledRequests.has(requestId)) {
              tokenSource.cancel();
              this._knownCanceledRequests.delete(requestId);
            }
          }

          switch (opType) {
            case OperationType.Request: {
              let promise: Promise<any>;

              try {
                let result: any;

                const handler = this._requestHandlers.get(method);
                if (handler) {
                  result = handler(...args);
                } else if (this._starRequestHandler) {
                  result = this._starRequestHandler(method, args);
                }

                promise = Promise.resolve(result);
              } catch (err) {
                promise = Promise.reject(err);
              }

              const onSuccess = (result: any) => {
                if (isReadableStream(result)) {
                  const responseHeaders: IResponseHeaders = {
                    chunked: true,
                  };
                  listenReadable(result, {
                    onData: (data) => {
                      this.socket.send(this.io.Response(requestId, method, responseHeaders, data));
                    },
                    onEnd: () => {
                      this.socket.send(this.io.Response(requestId, method, responseHeaders, null));
                    },
                  });
                } else {
                  this.socket.send(this.io.Response(requestId, method, nullHeaders, result));
                }

                this._cancellationTokenSources.delete(requestId);
              };

              const onError = (err: Error) => {
                this.traceRequestError(method, args, err);
                this.socket.send(this.io.Error(requestId, method, nullHeaders, err));
                this._cancellationTokenSources.delete(requestId);
              };

              promise.then(onSuccess).catch(onError);
              break;
            }
            case OperationType.Notification: {
              const handler = this._notificationHandlers.get(method);
              if (handler) {
                handler(...args);
              } else if (this._starNotificationHandler) {
                this._starNotificationHandler(method, args);
              }
              break;
            }
          }

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
    this._callbacks.forEach((cb) => cb(nullHeaders, new Error('Connection disposed')));

    this._callbacks.clear();
    this._cancellationTokenSources.clear();
    this.activeRequestPool.clear();

    this.disposable.dispose();
  }

  static forWSWebSocket(socket: WebSocket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new WSWebSocketConnection(socket), options);
  }

  static forNetSocket(socket: net.Socket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new NetSocketConnection(socket), options);
  }

  private traceRequestError(method: string, args: any[], error: any) {
    this.logger.error(`Error handling request ${method} with args `, args, error);
  }
}

class ActiveRequest implements IReadableStream<Uint8Array> {
  protected dataQ = new EventQueue<Uint8Array>();
  protected endQ = new EventQueue<void>();

  on(event: 'data', listener: (chunk: Uint8Array) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: unknown, listener: unknown): this {
    if (typeof event === 'string') {
      switch (event) {
        case 'data':
          this.onData(listener as (chunk: Uint8Array) => void);
          break;
        case 'end':
          this.onEnd(listener as () => void);
          break;
        default:
          break;
      }
    }
    return this;
  }

  onData(cb: (data: Uint8Array) => void): IDisposable {
    return this.dataQ.on(cb);
  }

  onEnd(cb: () => void): IDisposable {
    return this.endQ.on(cb);
  }

  constructor(protected requestId: number, protected responseHeaders: IResponseHeaders) {}

  emit(buffer: Uint8Array) {
    this.dataQ.push(buffer);
  }

  end() {
    this.dataQ.dispose();
    this.endQ.push(undefined);
    this.endQ.dispose();
  }
}
