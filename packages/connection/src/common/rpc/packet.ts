import { Serializer, Type } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';

import { Headers } from '@opensumi/ide-core-common/lib/types/rpc';
import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

import { furyFactory } from '../fury-extends/shared';

const ProtoVersionV1 = 1;

export enum OperationType {
  Request,
  Notification,
  Response,
  Heartbeat,
  Cancel,
}

export enum Status {
  OK,
  Err,
}

const { fury, reader, writer } = furyFactory();
export { reader };

const requestHeadersProto = Type.object('req-headers', {
  cancelable: Type.bool(),
});

export interface IRequestHeaders extends Headers {
  /**
   * If set to true, the request can be canceled.
   *
   * the server will push a `CancellationToken` to the request arguments.
   */
  cancelable?: boolean;
}

export const requestHeadersSerializer = generateSerializer(fury, requestHeadersProto) as Serializer<
  IRequestHeaders,
  IRequestHeaders
>;

export type IResponseHeaders = Headers;

export const responseHeadersProto = Type.object('resp-headers', {
  chunked: Type.bool(),
});

export const responseHeadersSerializer = generateSerializer(fury, responseHeadersProto) as Serializer<
  IResponseHeaders,
  IResponseHeaders
>;

export class MessageIO {
  static Request(requestId: number, rpcType: number, method: string, headers: IRequestHeaders, payload: Uint8Array) {
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(rpcType);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    requestHeadersSerializer.write(headers);
    writer.varUInt32(payload.length);
    writer.buffer(payload);

    return writer.dump();
  }

  static Cancel(requestId: number) {
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Cancel);
    writer.uint32(requestId);

    return writer.dump();
  }

  static Response(requestId: number, method: string, headers: Record<string, any>, payload: Uint8Array) {
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Response);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    writer.uint16(Status.OK);
    responseHeadersSerializer.write(headers);
    writer.varUInt32(payload.length);
    writer.buffer(payload);

    return writer.dump();
  }

  static Error(requestId: number, status: number, headers: Record<string, any>, error: any) {
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Response);
    writer.uint32(requestId);
    writer.uint16(status);
    responseHeadersSerializer.write(headers);
    writer.stringOfVarUInt32(stringifyError(error));

    return writer.dump();
  }
}
