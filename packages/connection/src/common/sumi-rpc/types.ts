import { TypeDescription } from '@furyjs/fury';

import { IDisposable } from '@opensumi/ide-core-common';
import {
  RPCProtocol as _RPCProtocol,
  RPCProtocolMethod as _RPCProtocolMethod,
  Request as _Request,
  Response as _Response,
} from '@opensumi/ide-core-common/lib/connection/types';

export type TSumiProtocol = _RPCProtocol<TypeDescription>;
export type TSumiProtocolMethod = _RPCProtocolMethod<TypeDescription>;
export type TSumiRequest = _Request<TypeDescription>;
export type TSumiResponse = _Response<TypeDescription>;

export type TRequestCallback = (
  headers: Record<string, any>,
  error?: Error,
  payload?: Uint8Array | string | any,
) => void;

export interface IBinaryConnectionSocket {
  send(data: Uint8Array): void;
  onmessage: (cb: (data: Uint8Array) => void) => IDisposable | void;
}

export type THandlerResult<R> = R | Promise<R>;

export type TGenericNotificationHandler = (...params: any[]) => void | Promise<void>;
export type TGenericRequestHandler<R> = (...params: any[]) => THandlerResult<R>;

export type TOnRequestNotFoundHandler = (method: string, params: any[]) => THandlerResult<any>;
export type TOnNotificationNotFoundHandler = (method: string, params: any[]) => THandlerResult<void>;
