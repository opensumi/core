import { TypeDescription } from '@furyjs/fury';

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
