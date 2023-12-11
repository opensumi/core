import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

const PROTO_VERSION = 1;

export const RPC_TYPE = {
  Request: 0,
  Notification: 1,
  Response: 2,
  Heartbeat: 3,
} as const;

export const CODEC = {
  Text: 0,
  Binary: 1,
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

export const createRequestPacket = (
  requestId: number,
  rpcType: number,
  method: string,
  headers: Record<string, any>,
  payload: Uint8Array,
) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(rpcType);
  writer.uint32(requestId);
  writer.uint8(CODEC.Binary);
  writer.stringOfVarInt32(method);
  writer.stringOfVarInt32(JSON.stringify(headers));
  writer.varInt32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createResponsePacket = (requestId: number, headers: Record<string, any>, payload: Uint8Array) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Response);
  writer.uint32(requestId);
  writer.uint8(CODEC.Binary);
  writer.uint16(ERROR_STATUS.OK);
  writer.stringOfVarInt32(JSON.stringify(headers));
  writer.varInt32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createErrorResponsePacket = (
  requestId: number,
  status: number,
  headers: Record<string, any>,
  error: any,
) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Response);
  writer.uint32(requestId);
  writer.uint8(CODEC.JSON);
  writer.uint16(status);
  writer.stringOfVarInt32(JSON.stringify(headers));
  writer.stringOfVarInt32(stringifyError(error));

  return writer.dump();
};
