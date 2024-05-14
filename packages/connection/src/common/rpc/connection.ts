import { getDebugLogger } from '@opensumi/ide-core-common';
import {
  CancellationToken,
  CancellationTokenSource,
  DisposableStore,
  IDisposable,
  canceled,
  parseError,
} from '@opensumi/ide-utils';
import { SumiReadableStream, isReadableStream, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { Capturer } from '../capturer';
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
  /**
   * The name of the connection, used for debugging(and can see in opensumi-devtools).
   */
  name?: string;
}

const chunkedResponseHeaders: IResponseHeaders = {
  chunked: true,
};

export class SumiConnection implements IDisposable {
  protected disposable = new DisposableStore();

  private _requestHandlers = new Map<string, TGenericRequestHandler<any>>();
  private _starRequestHandler: TRequestNotFoundHandler | undefined;
  private _notificationHandlers = new Map<string, TGenericNotificationHandler>();
  private _starNotificationHandler: TNotificationNotFoundHandler | undefined;

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  private readonly _timeoutHandles = new Map<number, NodeJS.Timeout | number>();
  private readonly _cancellationTokenSources = new Map<number, CancellationTokenSource>();
  private readonly _knownCanceledRequests = new Set<number>();

  protected activeRequestPool = new Map<number, SumiReadableStream<any>>();

  public io = new MessageIO();
  protected logger: ILogger;

  protected capturer: Capturer;

  constructor(protected socket: BaseConnection<Uint8Array>, protected options: ISumiConnectionOptions = {}) {
    if (options.logger) {
      this.logger = options.logger;
    } else {
      this.logger = getDebugLogger();
    }

    this.capturer = new Capturer(options.name || 'sumi');
    this.disposable.add(this.capturer);
  }

  sendNotification(method: string, ...args: any[]) {
    const requestId = this._requestId++;

    this.capturer.captureSendNotification(requestId, method, args);
    this.socket.send(this.io.Notification(requestId, method, nullHeaders, args));
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      const requestId = this._requestId++;

      this._callbacks.set(requestId, (headers, error, result) => {
        if (error) {
          this.traceRequestError(requestId, method, args, error);

          if (error === METHOD_NOT_REGISTERED) {
            // we should not treat `METHOD_NOT_REGISTERED` as an error.
            // it is a special case, it means the method is not registered on the other side.
            resolve(error);
            return;
          }

          reject(error);
          return;
        }

        this.capturer.captureSendRequestResult(requestId, method, result);

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

      this.capturer.captureSendRequest(requestId, method, args);

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
              this.logger.error(`Cannot find callback for request ${requestId}: ${method}, status: ${status}`);
              return;
            }

            this._callbacks.delete(requestId);

            callback(headers, error, result);
          };

          const headers = this.io.responseHeadersSerializer.read();
          let err: any;
          let result: any;
          if (status === Status.Err) {
            // todo: move to processor
            const content = reader.stringOfVarUInt32();
            err = parseError(content);
          } else {
            result = this.io.getProcessor(method).readResponse();
          }

          if (headers && headers.chunked) {
            let activeReq: SumiReadableStream<any>;
            if (this.activeRequestPool.has(requestId)) {
              activeReq = this.activeRequestPool.get(requestId)!;
            } else {
              // new stream request
              activeReq = new SumiReadableStream();
              this.activeRequestPool.set(requestId, activeReq);
              // resolve `activeReq` to caller
              runCallback(headers, undefined, activeReq);
            }

            if (result === null) {
              // when result is null, it means the stream is ended.
              activeReq.end();
              this.activeRequestPool.delete(requestId);
              break;
            }

            if (err) {
              activeReq.emitError(err);
              break;
            }

            activeReq.emitData(result);
            break;
          }

          runCallback(headers, err, result);
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
              this.capturer.captureOnRequest(requestId, method, args);

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
                this.capturer.captureOnRequestResult(requestId, method, result);

                if (isReadableStream(result)) {
                  listenReadable(result, {
                    onData: (data) => {
                      this.socket.send(this.io.Response(requestId, method, chunkedResponseHeaders, data));
                    },
                    onEnd: () => {
                      this.socket.send(this.io.Response(requestId, method, chunkedResponseHeaders, null));
                    },
                    onError: (err) => {
                      this.socket.send(this.io.Error(requestId, method, chunkedResponseHeaders, err));
                    },
                  });
                } else {
                  this.socket.send(this.io.Response(requestId, method, nullHeaders, result));
                }

                this._cancellationTokenSources.delete(requestId);
              };

              const onError = (err: Error) => {
                this.traceRequestError(requestId, method, args, err);

                this.socket.send(this.io.Error(requestId, method, nullHeaders, err));
                this._cancellationTokenSources.delete(requestId);
              };

              promise.then(onSuccess).catch(onError);
              break;
            }
            case OperationType.Notification: {
              this.capturer.captureOnNotification(requestId, method, args);

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
      this.disposable.add(toDispose);
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }

  static forWSWebSocket(socket: WebSocket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new WSWebSocketConnection(socket), options);
  }

  static forNetSocket(socket: net.Socket, options: ISumiConnectionOptions = {}) {
    return new SumiConnection(new NetSocketConnection(socket), options);
  }

  private traceRequestError(requestId: number, method: string, args: any[], error: any) {
    this.capturer.captureSendRequestFail(requestId, method, error);
  }
}
