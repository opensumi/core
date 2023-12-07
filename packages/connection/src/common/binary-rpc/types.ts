import { TypeDescription } from '@furyjs/fury';

import { IDisposable } from '@opensumi/ide-core-common';
import {
  RPCProtocol as _RPCProtocol,
  RPCProtocolMethod as _RPCProtocolMethod,
  Request as _Request,
  Response as _Response,
} from '@opensumi/ide-core-common/lib/connection/types';

export type RPCProtocol = _RPCProtocol<TypeDescription>;
export type RPCProtocolMethod = _RPCProtocolMethod<TypeDescription>;
export type Request = _Request<TypeDescription>;
export type Response = _Response<TypeDescription>;

export type RequestCallback = (error?: Error, payload?: Uint8Array | string | any) => void;

export interface BinaryConnectionSocket {
  send(data: Uint8Array): void;
  onmessage: (cb: (data: Uint8Array) => void) => IDisposable | void;
}

export type HandlerResult<R> = R | Promise<R>;

export type GenericNotificationHandler = (...params: any[]) => void | Promise<void>;
export type GenericRequestHandler<R> = (...params: any[]) => HandlerResult<R>;

export type OnRequestNotFoundHandler = (method: string, params: any[]) => HandlerResult<any>;
export type OnNotificationNotFoundHandler = (method: string, params: any[]) => HandlerResult<void>;
