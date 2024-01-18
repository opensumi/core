import { EventEmitter } from '@opensumi/events';
import { DisposableCollection, IDisposable, Disposable, parseError } from '@opensumi/ide-utils';

import { BaseConnection } from '../connection';
import { METHOD_NOT_REGISTERED } from '../constants';

import {
  CODEC,
  ERROR_STATUS,
  RPC_TYPE,
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

function isPromise<T = any>(obj: any): obj is Promise<T> {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

const assert = (condition: any, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const innerEvents = {
  onRequestNotFound: '##onRequestNotFound',
  onNotificationNotFound: '##onNotificationNotFound',
} as const;

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

  private protocolRepository: ProtocolRepository;

  constructor(private socket: BaseConnection<Uint8Array>) {}

  sendNotification(method: string, ...args: any[]) {
    if (!this.protocolRepository.has(method)) {
      throw new MethodProtocolNotFoundError(method);
    }

    const payload = this.protocolRepository.serializeRequest(method, args);
    this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Notification, method, {}, payload));
  }

  sendRequest(method: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      this._callbacks.set(this._requestId, (headers, error, buffer) => {
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
      this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Request, method, {}, payload));
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
    } else if (isPromise(result)) {
      result
        .then((result) => {
          const payload = this.protocolRepository.serializeResult(method, result);
          this.socket.send(createResponsePacket(requestId, {}, payload));
        })
        .catch((err) => {
          this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, {}, err));
        });
    } else {
      const payload = this.protocolRepository.serializeResult(method, result);
      this.socket.send(createResponsePacket(requestId, {}, payload));
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

      if (rpcType === RPC_TYPE.Response) {
        const callback = this._callbacks.get(requestId);
        if (!callback) {
          throw new Error(`No callback for request id: ${requestId}`);
        }

        const status = reader.uint16();
        const headers = readHeaders();

        // if error code is not 0, it's an error
        if (status !== ERROR_STATUS.OK) {
          // 错误信息用 JSON 格式，方便且兼容性好，可恢复成 Error
          assert(codec === CODEC.JSON, 'Error response should be JSON encoded');
          const content = reader.stringOfVarUInt32();
          const error = parseError(content);
          callback(headers, error);
          return;
        }

        if (codec === CODEC.Binary) {
          const contentLen = reader.varUInt32();
          const buffer = reader.buffer(contentLen);
          callback(headers, undefined, buffer);
          return;
        }

        const content = reader.stringOfVarUInt32();
        if (codec === CODEC.JSON) {
          callback(headers, undefined, JSON.parse(content));
        } else {
          callback(headers, undefined, content);
        }
      } else if (rpcType === RPC_TYPE.Notification || rpcType === RPC_TYPE.Request) {
        const method = reader.stringOfVarUInt32();
        const headers = readHeaders();

        const contentLen = reader.varUInt32();
        const content = reader.buffer(contentLen);
        const argsArray = this.protocolRepository.deserializeRequest(method, content);

        if (rpcType === RPC_TYPE.Request) {
          if (this._binaryEmitter.hasListener(method)) {
            this._binaryEmitter.emit(method, requestId, headers, argsArray);
          } else {
            this._innerEventEmitter.emit(innerEvents.onRequestNotFound, requestId, method, headers, argsArray);
          }
        } else {
          if (this._notificationEmitter.hasListener(method)) {
            this._notificationEmitter.emit(method, headers, argsArray);
          } else {
            this._innerEventEmitter.emit(innerEvents.onNotificationNotFound, method, headers, argsArray);
          }
        }
      } else {
        throw new Error(`Unknown rpc type: ${rpcType}`);
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
}

export class MethodProtocolNotFoundError extends Error {
  constructor(method: string) {
    super(`method ${method} not found`);
  }
}
