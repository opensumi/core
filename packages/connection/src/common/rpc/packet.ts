import { Serializer, Type } from '@furyjs/fury';
import Fury from '@furyjs/fury/dist/lib/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

const ProtoVersionV1 = 1;

export enum OperationType {
  Request,
  Notification,
  Response,
  Heartbeat,
  Cancel,
}

export enum BodyCodec {
  /**
   * Means no body
   */
  None,
  Text,
  Binary,
  JSON,
}

export enum ErrorCode {
  OK,
  Err,
}

export const fury = Fury({});
export const reader = fury.binaryReader;
export const writer = fury.binaryWriter;

const requestHeadersProto = Type.object('headers', {
  cancelable: Type.bool(),
});

export interface IRequestHeaders {
  /**
   * If set to true, the request can be canceled.
   *
   * the server will push a `CancellationToken` to the request arguments.
   */
  cancelable?: boolean;
}

export const requestHeadersSerializer = generateSerializer(fury, requestHeadersProto) as Serializer;

export const createRequestPacket = (
  requestId: number,
  rpcType: number,
  method: string,
  headers: IRequestHeaders,
  payload: Uint8Array,
) => {
  writer.reset();

  writer.uint8(ProtoVersionV1);
  writer.uint8(rpcType);
  writer.uint32(requestId);
  writer.uint8(BodyCodec.Binary);
  writer.stringOfVarUInt32(method);
  requestHeadersSerializer.write(headers);
  writer.varUInt32(payload.length);
  writer.buffer(payload);

  return writer.dump();
};

export const createCancelPacket = (requestId: number) => {
  writer.reset();

  writer.uint8(ProtoVersionV1);
  writer.uint8(OperationType.Cancel);
  writer.uint32(requestId);
  writer.uint8(BodyCodec.None);

  return writer.dump();
};

export const createResponsePacket = (requestId: number, headers: Record<string, any>, payload: Uint8Array) => {
  writer.reset();

  writer.uint8(ProtoVersionV1);
  writer.uint8(OperationType.Response);
  writer.uint32(requestId);
  writer.uint8(BodyCodec.Binary);
  writer.uint16(ErrorCode.OK);
  requestHeadersSerializer.write(headers);
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

  writer.uint8(ProtoVersionV1);
  writer.uint8(OperationType.Response);
  writer.uint32(requestId);
  writer.uint8(BodyCodec.JSON);
  writer.uint16(status);
  // headerSerializer.write(headers);
  writer.stringOfVarUInt32(stringifyError(error));

  return writer.dump();
};
