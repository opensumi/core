import { Type } from '@furyjs/fury';

import { ChannelMessage } from '../channel/types';
import { oneOf } from '../fury-extends/one-of';

import { ISerializer } from './types';

function baseFields() {
  return {
    id: Type.string(),
  };
}

export const PingProtocol = Type.object('ping', {
  ...baseFields(),
});

export const PongProtocol = Type.object('pong', {
  ...baseFields(),
});

export const OpenProtocol = Type.object('open', {
  ...baseFields(),
  clientId: Type.string(),
  path: Type.string(),
  traceId: Type.string(),
});

export const ServerReadyProtocol = Type.object('server-ready', {
  ...baseFields(),
  traceId: Type.string(),
});

export const ErrorProtocol = Type.object('error', {
  ...baseFields(),
  code: Type.uint16(),
  message: Type.string(),
});

export const DataProtocol = Type.object('data', {
  ...baseFields(),
  content: Type.string(),
});

export const BinaryProtocol = Type.object('binary', {
  ...baseFields(),
  binary: Type.binary(),
});

export const CloseProtocol = Type.object('close', {
  ...baseFields(),
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
