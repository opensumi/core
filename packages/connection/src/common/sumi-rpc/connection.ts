import { EventEmitter } from '@opensumi/events';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';
import { DisposableCollection, IDisposable, Disposable, parseError } from '@opensumi/ide-utils';

import {
  CODEC,
  ERROR_STATUS,
  RPC_TYPE,
  createErrorResponsePacket,
  createRequestPacket,
  createResponsePacket,
  reader,
} from './packet';
import {
  IBinaryConnectionSocket,
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
};

export class BinaryConnection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _binaryEmitter = new EventEmitter<string>();
  private _notificationEmitter = new EventEmitter<string>();

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  constructor(private socket: IBinaryConnectionSocket) {}

  sendNotification(method: string, payload: Uint8Array) {
    this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Notification, method, {}, payload));
  }

  sendRequest(method: string, payload: Uint8Array) {
    return new Promise<{ headers: Record<string, any>; result: Uint8Array }>((resolve, reject) => {
      this._callbacks.set(this._requestId, (headers, error, result) =>
        error ? reject(error) : resolve({ headers, result }),
      );
      this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Request, method, {}, payload));
    });
  }

  onNotification(method: string, handler: TGenericNotificationHandler): IDisposable {
    return Disposable.create(this._notificationEmitter.on(method, handler));
  }

  onNotificationNotFound(handler: TOnNotificationNotFoundHandler): IDisposable {
    return Disposable.create(this._notificationEmitter.on(innerEvents.onNotificationNotFound, handler));
  }

  private runRequestHandler<T extends (...args: any[]) => any>(handler: T, requestId: number, ...args: any[]) {
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
          this.socket.send(createResponsePacket(requestId, {}, result));
        })
        .catch((err) => {
          this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, {}, err));
        });
    } else {
      this.socket.send(createResponsePacket(requestId, {}, result));
    }
  }

  onRequest(method: string, _handler: TGenericRequestHandler<Uint8Array>): IDisposable {
    const handler = (requestId: number, headers: Record<string, any>, content: PlatformBuffer) => {
      this.runRequestHandler(_handler, requestId, headers, content);
    };
    return Disposable.create(this._binaryEmitter.on(method, handler));
  }

  onRequestNotFound(handler: TOnRequestNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, headers: Record<string, any>, params: any[]) => {
      this.runRequestHandler(handler, requestId, method, headers, params);
    };

    return Disposable.create(this._binaryEmitter.on(innerEvents.onRequestNotFound, handlerWrapper));
  }

  listen() {
    const toDispose = this.socket.onmessage((data) => {
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
        const contentLen = reader.varInt32();

        // if error code is not 0, it's an error
        if (status !== 0) {
          // 错误信息用 JSON 格式，方便且兼容性好，可恢复成 Error
          assert(codec === CODEC.JSON, 'Error response should be JSON encoded');
          const content = reader.stringUtf8(contentLen);
          const error = parseError(content);
          callback(headers, error);
          return;
        }

        if (codec === CODEC.Binary) {
          const buffer = reader.buffer(contentLen);
          callback(headers, undefined, buffer);
          return;
        }

        const content = reader.stringUtf8(contentLen);
        if (codec === CODEC.JSON) {
          callback(headers, undefined, JSON.parse(content));
        } else {
          callback(headers, undefined, content);
        }
      } else if (rpcType === RPC_TYPE.Notification || rpcType === RPC_TYPE.Request) {
        const method = readMethod();
        const headers = readHeaders();

        const contentLen = reader.varInt32();
        const content = reader.buffer(contentLen);

        if (rpcType === RPC_TYPE.Request) {
          if (this._binaryEmitter.hasListener(method)) {
            this._binaryEmitter.emit(method, requestId, headers, content);
          } else {
            this._binaryEmitter.emit(innerEvents.onRequestNotFound, requestId, method, headers, content);
          }
        } else {
          if (this._notificationEmitter.hasListener(method)) {
            this._notificationEmitter.emit(method, content);
          } else {
            this._notificationEmitter.emit(innerEvents.onNotificationNotFound, method, headers, content);
          }
        }
      } else {
        throw new Error(`Unknown rpc type: ${rpcType}`);
      }

      function readMethod() {
        const methodLen = reader.varInt32();
        return reader.stringUtf8(methodLen);
      }

      function readHeaders() {
        const headerLen = reader.varInt32();
        const header = reader.stringUtf8(headerLen);
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
