import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

const PROTO_VERSION = 1;

export enum RPC_TYPE {
  Request,
  Notification,
  Response,
  Heartbeat,
  Cancel,
}

export enum BODY_CODEC {
  /**
   * Means no body
   */
  None,
  Text,
  Binary,
  JSON,
}

export enum ERROR_STATUS {
  OK,
  EXEC_ERROR,
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
  writer.uint8(BODY_CODEC.Binary);
  writer.stringOfVarUInt32(method);
  writer.stringOfVarUInt32(JSON.stringify(headers));
  writer.varUInt32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createCancelPacket = (requestId: number) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Cancel);
  writer.uint32(requestId);
  writer.uint8(BODY_CODEC.None);

  return writer.dump();
};

export const createResponsePacket = (requestId: number, headers: Record<string, any>, payload: Uint8Array) => {
  writer.reset();

  writer.uint8(PROTO_VERSION);
  writer.uint8(RPC_TYPE.Response);
  writer.uint32(requestId);
  writer.uint8(BODY_CODEC.Binary);
  writer.uint16(ERROR_STATUS.OK);
  writer.stringOfVarUInt32(JSON.stringify(headers));
  writer.varUInt32(payload.length);
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
  writer.uint8(BODY_CODEC.JSON);
  writer.uint16(status);
  writer.stringOfVarUInt32(JSON.stringify(headers));
  writer.stringOfVarUInt32(stringifyError(error));

  return writer.dump();
};
