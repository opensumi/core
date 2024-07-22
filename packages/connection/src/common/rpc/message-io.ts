import Fury, { Serializer, Type, TypeDescription } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';
import { PlatformBuffer } from '@furyjs/fury/dist/lib/platformBuffer';
import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { parseError, stringifyError } from '@opensumi/ide-core-common/lib/utils';

import { AnySerializer, IObjectTransfer } from '../fury-extends/any';
import { furyFactory } from '../fury-extends/shared';

import {
  IProtocolSerializer,
  IRequestHeaders,
  IResponseHeaders,
  ITransferable,
  TSerializer,
  TSumiProtocol,
  TSumiProtocolMethod,
} from './types';

const ProtoVersionV1 = 1;

export enum OperationType {
  Request,
  Notification,
  Response,
  Cancel,
  Error,
}

export const HeadersProto = {
  Request: Type.object('req-headers', {
    cancelable: Type.bool(),
  }),
  Response: Type.object('resp-headers', {
    chunked: Type.bool(),
  }),
} as const;

const PacketPrefix = {
  Request: (OperationType.Request << 8) | ProtoVersionV1,
  Notification: (OperationType.Notification << 8) | ProtoVersionV1,
  Response: (OperationType.Response << 8) | ProtoVersionV1,
  Cancel: (OperationType.Cancel << 8) | ProtoVersionV1,
  Error: (OperationType.Error << 8) | ProtoVersionV1,
} as const;

class SumiProtocolSerializer implements IProtocolSerializer {
  request: TSerializer;
  result: TSerializer;

  constructor(methodProtocol: TSumiProtocolMethod, public fury: Fury) {
    const argsTuple = [] as TypeDescription[];

    for (const element of methodProtocol.request) {
      argsTuple.push(element.type);
    }

    const requestProto = Type.tuple(argsTuple);

    let resultProto: TypeDescription = Type.any();

    if (methodProtocol.response && methodProtocol.response.type) {
      resultProto = methodProtocol.response.type;
    }

    this.request = this.fury.registerSerializer(requestProto);
    this.result = this.fury.registerSerializer(resultProto);
  }

  writeRequest(args: any[]): void {
    return this.request.serializer.write(args);
  }
  readRequest(): any[] {
    return this.request.serializer.read();
  }
  writeResponse<T = ITransferable>(result: T): void {
    return this.result.serializer.write(result);
  }
  readResponse<T = ITransferable>(): T {
    return this.result.serializer.read();
  }
}

export class AnyProtocolSerializer implements IProtocolSerializer {
  protected anySerializer: AnySerializer;

  constructor(public writer: BinaryWriter, public reader: BinaryReader, objectTransfer?: IObjectTransfer) {
    this.anySerializer = new AnySerializer(this.writer, this.reader, objectTransfer);
  }

  writeRequest(args: any[]): void {
    this.anySerializer.write(args);
  }
  readRequest(): any[] {
    return this.anySerializer.read();
  }
  writeResponse<T = any>(result: T): void {
    this.anySerializer.write(result);
  }
  readResponse<T = any>(): T {
    return this.anySerializer.read();
  }
}

export interface RPCRequestMessage {
  kind: OperationType.Request;
  requestId: number;
  method: string;
  headers: IRequestHeaders;
  args: any[];
}

export interface RPCNotificationMessage {
  kind: OperationType.Notification;
  requestId: number;
  method: string;
  headers: IRequestHeaders;
  args: any[];
}

export interface RPCResponseMessage {
  kind: OperationType.Response;
  requestId: number;
  method: string;
  headers: IResponseHeaders;
  result: any;
}

export interface RPCErrorMessage {
  kind: OperationType.Error;
  requestId: number;
  method: string;
  headers: IResponseHeaders;
  error: any;
}

export interface RPCCancelMessage {
  kind: OperationType.Cancel;
  requestId: number;
}

export type RPCMessage =
  | RPCRequestMessage
  | RPCNotificationMessage
  | RPCResponseMessage
  | RPCErrorMessage
  | RPCCancelMessage;

export abstract class IMessageIO<T = any> {
  abstract loadProtocolMethod?(
    methodProtocol: TSumiProtocolMethod,
    options?: { nameConverter?: (str: string) => string },
  ): void;

  abstract Request(requestId: number, method: string, headers: IRequestHeaders, args: any[]): T;
  abstract Notification(requestId: number, method: string, headers: IRequestHeaders, args: any[]): T;
  abstract Cancel(requestId: number): T;
  abstract Response(requestId: number, method: string, headers: Record<string, any>, result: any): T;
  abstract Error(requestId: number, method: string, headers: Record<string, any>, error: any): T;

  abstract parse(data: T): RPCMessage;
}

export class MessageIO extends IMessageIO<PlatformBuffer> {
  fury: Fury;
  reader: BinaryReader;
  writer: BinaryWriter;

  private serializerMap = new Map<string, SumiProtocolSerializer>();

  private anySerializer: IProtocolSerializer;

  requestHeadersSerializer: Serializer<IRequestHeaders, IRequestHeaders>;
  responseHeadersSerializer: Serializer<IResponseHeaders, IRequestHeaders>;

  constructor() {
    super();
    const fury = furyFactory();
    this.fury = fury.fury;
    this.reader = fury.reader;
    this.writer = fury.writer;

    this.requestHeadersSerializer = generateSerializer(this.fury, HeadersProto.Request);
    this.responseHeadersSerializer = generateSerializer(this.fury, HeadersProto.Response);

    this.anySerializer = new AnyProtocolSerializer(this.writer, this.reader);
  }

  setAnySerializer(serializer: IProtocolSerializer) {
    this.anySerializer = serializer;
  }

  has(name: string) {
    return this.serializerMap.has(name);
  }

  loadProtocol(
    protocol: TSumiProtocol,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    const { methods } = protocol;

    for (const proto of methods) {
      this.loadProtocolMethod(proto, options);
    }
  }

  loadProtocolMethod(
    methodProtocol: TSumiProtocolMethod,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    let method = methodProtocol.method;
    if (options?.nameConverter) {
      method = options.nameConverter(method);
    }
    this.serializerMap.set(method, new SumiProtocolSerializer(methodProtocol, this.fury));
  }

  getProcessor(method: string): IProtocolSerializer {
    const processor = this.serializerMap.get(method);
    if (processor) {
      return processor;
    }
    return this.anySerializer;
  }

  Notification(requestId: number, method: string, headers: IRequestHeaders, args: any[]) {
    const { writer } = this;
    writer.reset();

    writer.uint16(PacketPrefix.Notification);
    writer.uint32(requestId);

    writer.stringOfVarUInt32(method);
    this.requestHeadersSerializer.write(headers);
    this.getProcessor(method).writeRequest(args);

    return writer.dump();
  }

  Request(requestId: number, method: string, headers: IRequestHeaders, args: any[]) {
    const { writer } = this;
    writer.reset();

    writer.uint16(PacketPrefix.Request);
    writer.uint32(requestId);

    writer.stringOfVarUInt32(method);
    this.requestHeadersSerializer.write(headers);
    this.getProcessor(method).writeRequest(args);

    return writer.dump();
  }

  Cancel(requestId: number) {
    const { writer } = this;
    writer.reset();

    writer.uint16(PacketPrefix.Cancel);
    writer.uint32(requestId);

    return writer.dump();
  }

  Response(requestId: number, method: string, headers: Record<string, any>, result: any) {
    const { writer } = this;
    writer.reset();

    writer.uint16(PacketPrefix.Response);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    this.responseHeadersSerializer.write(headers);
    this.getProcessor(method).writeResponse(result);

    return writer.dump();
  }

  Error(requestId: number, method: string, headers: Record<string, any>, error: any) {
    const { writer } = this;
    writer.reset();

    writer.uint16(PacketPrefix.Error);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    this.responseHeadersSerializer.write(headers);
    writer.stringOfVarUInt32(stringifyError(error));

    return writer.dump();
  }

  parse(data: PlatformBuffer): RPCMessage {
    const { reader } = this;
    reader.reset(data);

    // skip version, currently only have version 1
    reader.skip(1);
    const opType = reader.uint8() as OperationType;
    const requestId = reader.uint32();

    switch (opType) {
      case OperationType.Request:
      case OperationType.Notification: {
        const method = reader.stringOfVarUInt32();
        const headers = this.requestHeadersSerializer.read() as IRequestHeaders;
        const args = this.getProcessor(method).readRequest();
        return {
          kind: opType,
          requestId,
          method,
          headers,
          args,
        };
      }
      case OperationType.Error: {
        const method = reader.stringOfVarUInt32();
        const headers = this.responseHeadersSerializer.read() as IResponseHeaders;
        const error = parseError(reader.stringOfVarUInt32());
        return {
          kind: OperationType.Error,
          requestId,
          method,
          headers,
          error,
        };
      }
      case OperationType.Response: {
        const method = reader.stringOfVarUInt32();
        const headers = this.responseHeadersSerializer.read() as IResponseHeaders;
        const result = this.getProcessor(method).readResponse();
        return {
          kind: OperationType.Response,
          requestId,
          method,
          headers,
          result,
        };
      }
      case OperationType.Cancel:
        return {
          kind: OperationType.Cancel,
          requestId,
        };
      default:
        throw new Error(`Unknown message type: ${opType}`);
    }
  }
}

/**
 * 请不要使用 RawMessageIO 作为与 Worker-Host 之间的通信协议
 * 因为与插件层的通信需要正确的反序列化和序列化 Uri/URI/vscode-uri 这三种 uri
 * TODO: 兼容 Uri/URI/vscode-uri 的序列化和反序列化
 */
export class RawMessageIO implements IMessageIO<RPCMessage> {
  Request(requestId: number, method: string, headers: IRequestHeaders, args: any[]): RPCRequestMessage {
    return {
      kind: OperationType.Request,
      requestId,
      method,
      headers,
      args,
    };
  }
  Notification(requestId: number, method: string, headers: IRequestHeaders, args: any[]): RPCNotificationMessage {
    return {
      kind: OperationType.Notification,
      requestId,
      method,
      headers,
      args,
    };
  }
  Cancel(requestId: number): RPCCancelMessage {
    return {
      kind: OperationType.Cancel,
      requestId,
    };
  }
  Response(requestId: number, method: string, headers: Record<string, any>, result: any): RPCResponseMessage {
    return {
      kind: OperationType.Response,
      requestId,
      headers,
      method,
      result,
    };
  }
  Error(requestId: number, method: string, headers: Record<string, any>, error: any): RPCErrorMessage {
    return {
      kind: OperationType.Error,
      requestId,
      method,
      headers,
      error,
    };
  }

  parse(data: any): RPCMessage {
    return data;
  }
}
