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

import { BaseConnection, NetSocketConnection, WSWebSocketConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';
import { ILogger } from '../types';

import { MethodTimeoutError } from './errors';
import { OperationType, ProtocolRepository, Status } from './protocol-repository';
import {
  IRequestHeaders,
  IResponseHeaders,
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

type NotificationHandler = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => void;
type RequestHandler = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => void;

export class SumiConnection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _handlers = new Map<string, RequestHandler>();
  private _notificationEmitter = new Map<string, NotificationHandler>();

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
    this.socket.send(
      this.protocolRepository.Request(this._requestId++, OperationType.Notification, method, nullHeaders, args),
    );
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      const requestId = this._requestId++;

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

      this.socket.send(
        this.protocolRepository.Request(
          requestId,
          OperationType.Request,
          method,
          {
            cancelable: Boolean(cancellationToken) || undefined,
          },
          args,
        ),
      );
    });
  }

  onNotification(method: string, handler: TGenericNotificationHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      handler(...args);
    };
    this._notificationEmitter.set(method, handlerWrapper);
    return {
      dispose: () => {
        this._notificationEmitter.delete(method);
      },
    };
  }

  onNotificationNotFound(handler: TOnNotificationNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      handler(method, args);
    };
    this._notificationEmitter.set(star, handlerWrapper);
    return {
      dispose: () => {
        this._notificationEmitter.delete(star);
      },
    };
  }

  cancelRequest(requestId: number) {
    this.socket.send(this.protocolRepository.Cancel(requestId));
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
            this.socket.send(this.protocolRepository.Response(requestId, method, responseHeaders, data));
          },
          onEnd: () => {
            this.socket.send(this.protocolRepository.Response(requestId, method, responseHeaders, null));
          },
        });
        return;
      }

      this.socket.send(this.protocolRepository.Response(requestId, method, nullHeaders, result));
      this._cancellationTokenSources.delete(requestId);
    };

    const onError = (err: Error) => {
      this.socket.send(this.protocolRepository.Error(requestId, method, nullHeaders, err));
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
    this._handlers.set(method, handlerWrapper);
    return {
      dispose: () => {
        this._handlers.delete(method);
      },
    };
  }

  onRequestNotFound(handler: TOnRequestNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, args: any[]) => {
      this.runRequestHandler(requestId, method, [method, args], handler);
    };

    this._handlers.set(star, handlerWrapper);
    return {
      dispose: () => {
        this._handlers.delete(star);
      },
    };
  }

  setProtocolRepository(protocolRepository: ProtocolRepository) {
    this.protocolRepository = protocolRepository;
  }

  listen() {
    const { reader } = this.protocolRepository;

    const toDispose = this.socket.onMessage((data) => {
      reader.reset(data);
      // skip version, currently only have version 1
      reader.skip(1);

      const opType = reader.uint8();
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

      switch (opType) {
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

          const headers = this.protocolRepository.responseHeadersSerializer.read();

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

                const result = this.protocolRepository.getProcessor(method).readResponse() as Uint8Array;

                if (result) {
                  activeReq.emit(result);
                  break;
                }

                activeReq.end();
                this.activeRequestPool.delete(requestId);
              } else {
                const result = this.protocolRepository.getProcessor(method).readResponse();
                runCallback(headers, undefined, result);
              }
            }
          }

          break;
        }
        case OperationType.Notification:
        // fall through
        case OperationType.Request: {
          const headers = this.protocolRepository.requestHeadersSerializer.read() as IRequestHeaders;
          const args = this.protocolRepository.getProcessor(method).readRequest();

          this._receiveRequest(opType, requestId, method, headers, args);
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

  protected _receiveRequest(opType: number, requestId: number, method: string, headers: IRequestHeaders, args: any[]) {
    if (headers.cancelable) {
      const tokenSource = new CancellationTokenSource();
      this._cancellationTokenSources.set(requestId, tokenSource);
      args.push(tokenSource.token);

      if (this._knownCanceledRequests.has(requestId)) {
        tokenSource.cancel();
        this._knownCanceledRequests.delete(requestId);
      }
    }

    if (opType === OperationType.Request) {
      const eventName = this._handlers.has(method) ? method : star;
      const handler = this._handlers.get(eventName);
      handler && handler(requestId, method, headers, args);
    } else {
      const eventName = this._notificationEmitter.has(method) ? method : star;
      const handler = this._notificationEmitter.get(eventName);
      handler && handler(requestId, method, headers, args);
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
