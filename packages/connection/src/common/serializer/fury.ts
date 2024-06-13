import { Type } from '@furyjs/fury';

import { ChannelMessage } from '../channel/types';
import { oneOf } from '../fury-extends/one-of';

import { ISerializer } from './types';

export const PingProtocol = Type.object('ping', {
  id: Type.string(),
});

export const PongProtocol = Type.object('pong', {
  id: Type.string(),
});

export const OpenProtocol = Type.object('open', {
  clientId: Type.string(),
  id: Type.string(),
  path: Type.string(),
  connectionToken: Type.string(),
});

export const ServerReadyProtocol = Type.object('server-ready', {
  id: Type.string(),
  token: Type.string(),
});

export const ErrorProtocol = Type.object('error', {
  id: Type.string(),
  code: Type.uint16(),
  message: Type.string(),
});

export const DataProtocol = Type.object('data', {
  id: Type.string(),
  content: Type.string(),
});

export const BinaryProtocol = Type.object('binary', {
  id: Type.string(),
  binary: Type.binary(),
});

export const CloseProtocol = Type.object('close', {
  id: Type.string(),
  code: Type.uint32(),
  reason: Type.string(),
});

const serializer = oneOf([
  PingProtocol,
  PongProtocol,
  OpenProtocol,
  ServerReadyProtocol,
  DataProtocol,
  BinaryProtocol,
  CloseProtocol,
  ErrorProtocol,
]);

export const furySerializer: ISerializer<ChannelMessage, Uint8Array> = serializer;
