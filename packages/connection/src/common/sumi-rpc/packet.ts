import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

const PROTO_VERSION = 1;

export const RPC_TYPE = {
  Request: 0,
  Notification: 1,
  Response: 2,
} as const;

export const CODEC = {
  Text: 0,
  Fury: 1,
  JSON: 2,
};

export const ERROR_STATUS = {
  OK: 0,
  EXEC_ERROR: 1,
  PARSE_ERROR: 2,
  SERVER_ERROR: 3,
};

export const reader = BinaryReader({});
const writer = BinaryWriter({});

export const createRequestPacket = (requestId: number, rpcType: number, method: string, payload: Uint8Array) => {
  writer.reset();
  writer.uint8(PROTO_VERSION);
  writer.uint8(rpcType);
  writer.uint32(requestId);
  writer.uint8(CODEC.Fury);
  writer.stringOfVarInt32(method);
  writer.uint32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createResponsePacket = (requestId: number, payload: Uint8Array) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Response);
  writer.uint32(requestId);
  writer.uint8(CODEC.Fury);
  writer.uint16(ERROR_STATUS.OK);
  writer.uint32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createErrorResponsePacket = (requestId: number, status: number, error: any) => {
  const errorString = stringifyError(error);
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Response);
  writer.uint32(requestId);
  writer.uint8(CODEC.JSON);
  writer.uint16(status);
  writer.stringOfVarInt32(errorString);

  return writer.dump();
};
