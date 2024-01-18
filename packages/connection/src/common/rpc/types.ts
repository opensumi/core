import { TypeDescription } from '@furyjs/fury';

import {
  RPCProtocol as _RPCProtocol,
  RPCProtocolMethod as _RPCProtocolMethod,
  Request as _Request,
  Response as _Response,
} from '@opensumi/ide-core-common/lib/types/rpc';

export type TSumiProtocol = _RPCProtocol<TypeDescription>;
export type TSumiProtocolMethod = _RPCProtocolMethod<TypeDescription>;
export type TSumiRequest = _Request<TypeDescription>;
export type TSumiResponse = _Response<TypeDescription>;

export type TRequestCallback = (headers: Record<string, any>, error?: any, payload?: Uint8Array | string | any) => void;

export type THandlerResult<R> = R | Promise<R>;

export type TGenericNotificationHandler = (...args: any[]) => void | Promise<void>;
export type TGenericRequestHandler<R> = (...args: any[]) => THandlerResult<R>;

export type TOnRequestNotFoundHandler = (method: string, args: any[]) => THandlerResult<any>;
export type TOnNotificationNotFoundHandler = (method: string, args: any[]) => THandlerResult<void>;
