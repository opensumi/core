import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';
import { IDisposable } from '@opensumi/ide-utils';
import { Dispatcher } from '@opensumi/ide-utils/lib/event';

import { reviveError } from './fury-rpc/error-like';
import {
  CODEC,
  ERROR_STATUS,
  RPC_TYPE,
  createRPCErrorResponse,
  createRpcBinaryRequest,
  createRpcBinaryResponse,
  reader,
} from './fury-rpc/packet';
import { RequestCallback } from './fury-rpc/types';

function isPromise<T = any>(obj: any): obj is Promise<T> {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

const assert = (condition: any, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

interface IBinaryDispatcherPayload {
  requestId: number;
  content: PlatformBuffer;
}

export interface BinaryConnectionSocket {
  send(data: Uint8Array): void;
  onmessage: (cb: (data: Uint8Array) => void) => IDisposable | void;
}

type HandlerResult<R> = R | Promise<R>;

export type GenericNotificationHandler = (...params: any[]) => void | Promise<void>;
export type GenericRequestHandler<R> = (...params: any[]) => HandlerResult<R>;

export class BinaryConnection {
  private _binaryDispatcher = new Dispatcher<IBinaryDispatcherPayload>();
  private _notificationDispatcher = new Dispatcher<PlatformBuffer>();

  private _requestId = 0;
  private _callbacks = new Map<number, RequestCallback>();

  constructor(private _socket: BinaryConnectionSocket) {
    this._socket.onmessage((data) => {
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

        // 非 0 为错误
        const errorCode = reader.uint16();

        if (errorCode) {
          // 错误信息用 JSON 格式，方便且兼容性好，可恢复成 Error
          assert(codec === CODEC.JSON, 'Only support JSON error');
          const contentLen = reader.varInt32();
          const content = reader.stringUtf8(contentLen);
          const error = reviveError(JSON.parse(content));
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
          this._binaryDispatcher.dispatch(method, { requestId, content });
        } else {
          this._notificationDispatcher.dispatch(method, content);
        }
      } else {
        throw new Error(`Unknown rpc type: ${rpcType}`);
      }
    });
  }

  sendNotification(method: string, payload: Uint8Array) {
    this._socket.send(createRpcBinaryRequest(this._requestId++, RPC_TYPE.Notification, method, payload));
  }

  sendRequest(method: string, payload: Uint8Array) {
    return new Promise<Uint8Array>((resolve, reject) => {
      this._callbacks.set(this._requestId, (error, result) => (error ? reject(error) : resolve(result)));
      this._socket.send(createRpcBinaryRequest(this._requestId++, RPC_TYPE.Request, method, payload));
    });
  }

  onNotification(method: string, handler: GenericNotificationHandler): IDisposable {
    return this._notificationDispatcher.on(method)(handler);
  }
  onRequest(method: string, _handler: GenericRequestHandler<Uint8Array>): IDisposable {
    const handler = (data: IBinaryDispatcherPayload) => {
      const { requestId, content } = data;
      let result: any;
      let error: Error | undefined;
      try {
        result = _handler(content);
      } catch (err) {
        error = err;
      }

      if (error) {
        this._socket.send(createRPCErrorResponse(requestId, ERROR_STATUS.EXEC_ERROR, error));
      }

      if (isPromise(result)) {
        result
          .then((result) => {
            this._socket.send(createRpcBinaryResponse(requestId, result));
          })
          .catch((err) => {
            this._socket.send(createRPCErrorResponse(requestId, ERROR_STATUS.EXEC_ERROR, err));
          });
      } else {
        this._socket.send(createRpcBinaryResponse(requestId, result));
      }
    };
    return this._binaryDispatcher.on(method)(handler);
  }

  listen() {}
}

export function createBinaryConnection(socket: any) {
  return new BinaryConnection({
    onmessage: (cb) => {
      if (socket.onMessage) {
        socket.onMessage((message) => {
          cb(message);
        });
      } else if (socket.onmessage) {
        socket.onmessage = (message) => {
          cb(message);
        };
      } else if (socket.on) {
        socket.on('message', (message) => {
          cb(message);
        });
      }
    },
    send(data) {
      socket.send(data);
    },
  });
}
