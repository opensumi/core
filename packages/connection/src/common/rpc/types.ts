import {
  Headers,
  RPCProtocol as _RPCProtocol,
  RPCProtocolMethod as _RPCProtocolMethod,
  Request as _Request,
  Response as _Response,
} from '@opensumi/ide-core-common/lib/types/rpc';

import type Fury from '@furyjs/fury';
import type { Serializer, TypeDescription } from '@furyjs/fury';

export type TSumiProtocol = _RPCProtocol<TypeDescription>;
export type TSumiProtocolMethod = _RPCProtocolMethod<TypeDescription>;
export type TSumiRequest = _Request<TypeDescription>;
export type TSumiResponse = _Response<TypeDescription>;

export type TRequestCallback = (headers: Record<string, any>, error?: any, payload?: any) => void;

export type THandlerResult<R> = R | Promise<R>;

export type TGenericNotificationHandler = (...args: any[]) => void | Promise<void>;
export type TGenericRequestHandler<R> = (...args: any[]) => THandlerResult<R>;

export type TRequestNotFoundHandler = (method: string, args: any[]) => THandlerResult<any>;
export type TNotificationNotFoundHandler = (method: string, args: any[]) => THandlerResult<void>;

export type TSerializer = { serializer: Serializer } & Omit<ReturnType<Fury['registerSerializer']>, 'serializer'>;

export interface IRequestHeaders extends Headers {
  /**
   * If set to true, the request can be canceled.
   *
   * the server will push a `CancellationToken` to the request arguments.
   */
  cancelable?: boolean;
}

export type IResponseHeaders = Headers;

export type ITransferable = any;
export type TRequestTransferable = ITransferable[];

export interface IProtocolSerializer {
  writeRequest(args: any[]): void;
  readRequest(): any[];
  writeResponse<T = any>(result: T): void;
  readResponse<T = any>(): T;
}
