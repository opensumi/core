import type WebSocketWS from 'ws';

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
  onRequestNotFound: '#onRequestNotFound',
  onNotificationNotFound: '#onNotificationNotFound',
};

export class BinaryConnection implements IDisposable {
  protected disposable = new DisposableCollection();

  private _binaryEmitter = new EventEmitter<string>();
  private _notificationEmitter = new EventEmitter<string>();

  private _requestId = 0;
  private _callbacks = new Map<number, TRequestCallback>();

  constructor(private socket: IBinaryConnectionSocket) {}

  sendNotification(method: string, payload: Uint8Array) {
    this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Notification, method, payload));
  }

  sendRequest(method: string, payload: Uint8Array) {
    return new Promise<Uint8Array>((resolve, reject) => {
      this._callbacks.set(this._requestId, (error, result) => (error ? reject(error) : resolve(result)));
      this.socket.send(createRequestPacket(this._requestId++, RPC_TYPE.Request, method, payload));
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
      this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, error));
    }

    if (isPromise(result)) {
      result
        .then((result) => {
          this.socket.send(createResponsePacket(requestId, result));
        })
        .catch((err) => {
          this.socket.send(createErrorResponsePacket(requestId, ERROR_STATUS.EXEC_ERROR, err));
        });
    } else {
      this.socket.send(createResponsePacket(requestId, result));
    }
  }

  onRequest(method: string, _handler: TGenericRequestHandler<Uint8Array>): IDisposable {
    const handler = (requestId: number, content: PlatformBuffer) => {
      this.runRequestHandler(_handler, requestId, content);
    };
    return Disposable.create(this._binaryEmitter.on(method, handler));
  }

  onRequestNotFound(handler: TOnRequestNotFoundHandler): IDisposable {
    const handlerWrapper = (requestId: number, method: string, params: any[]) => {
      this.runRequestHandler(handler, requestId, method, params);
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

        // if error code is not 0, it's an error
        const errorCode = reader.uint16();

        if (errorCode) {
          // 错误信息用 JSON 格式，方便且兼容性好，可恢复成 Error
          assert(codec === CODEC.JSON, 'Only support JSON error');
          const contentLen = reader.varInt32();
          const content = reader.stringUtf8(contentLen);
          const error = parseError(content);
          callback(error);
          return;
        }

        if (codec === CODEC.Fury) {
          const contentLen = reader.uint32();
          const buffer = reader.buffer(contentLen);
          callback(undefined, buffer);
          return;
        }

        const contentLen = reader.varInt32();
        const content = reader.stringUtf8(contentLen);
        if (codec === CODEC.JSON) {
          callback(undefined, JSON.parse(content));
        } else {
          callback(undefined, content);
        }
      } else if (rpcType === RPC_TYPE.Notification || rpcType === RPC_TYPE.Request) {
        const methodLen = reader.varInt32();
        const method = reader.stringUtf8(methodLen);
        const contentLen = reader.uint32();
        const content = reader.buffer(contentLen);

        // todo: check a method is valid
        if (rpcType === RPC_TYPE.Request) {
          if (this._binaryEmitter.hasListener(method)) {
            this._binaryEmitter.emit(method, requestId, content);
          } else {
            this._binaryEmitter.emit(innerEvents.onRequestNotFound, requestId, method, content);
          }
        } else {
          if (this._notificationEmitter.hasListener(method)) {
            this._notificationEmitter.emit(method, content);
          } else {
            this._notificationEmitter.emit(innerEvents.onNotificationNotFound, method, content);
          }
        }
      } else {
        throw new Error(`Unknown rpc type: ${rpcType}`);
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

export function createBinaryConnectionForWS(socket: WebSocketWS) {
  return new BinaryConnection({
    onmessage: (cb) => {
      const handler = (data: Uint8Array) => {
        cb(data);
      };

      socket.on('message', handler);
      return {
        dispose() {
          socket.off('message', handler);
        },
      };
    },
    send(data) {
      socket.send(data);
    },
  });
}
