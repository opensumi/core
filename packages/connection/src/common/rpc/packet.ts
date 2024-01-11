import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

const PROTO_VERSION = 1;

export enum RPC_TYPE {
  Handshake,
  Request,
  Notification,
  Response,
  Heartbeat,
}

export enum CODEC {
  Text,
  Binary,
  JSON,
}

export enum ERROR_STATUS {
  OK,
  EXEC_ERROR,
  PARSE_ERROR,
  SERVER_ERROR,
}

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
