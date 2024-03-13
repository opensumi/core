import Fury, { Serializer, Type, TypeDescription } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';
import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

import { AnySerializer } from '../fury-extends/any';
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
}

export enum Status {
  OK,
  Err,
}

export const HeadersProto = {
  Request: Type.object('req-headers', {
    cancelable: Type.bool(),
  }),
  Response: Type.object('resp-headers', {
    chunked: Type.bool(),
  }),
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
    const resultProto = methodProtocol.response.type || Type.any();

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

class AnyProtocolSerializer implements IProtocolSerializer {
  anySerializer: AnySerializer;

  constructor(public writer: BinaryWriter, public reader: BinaryReader) {
    this.anySerializer = new AnySerializer(this.writer, this.reader);
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

export class MessageIO {
  fury: Fury;
  reader: BinaryReader;
  writer: BinaryWriter;

  private serializerMap = new Map<string, SumiProtocolSerializer>();

  private anySerializer: AnyProtocolSerializer;

  requestHeadersSerializer: Serializer<IRequestHeaders, IRequestHeaders>;
  responseHeadersSerializer: Serializer<IResponseHeaders, IRequestHeaders>;

  constructor() {
    const fury = furyFactory();
    this.fury = fury.fury;
    this.reader = fury.reader;
    this.writer = fury.writer;

    this.requestHeadersSerializer = generateSerializer(this.fury, HeadersProto.Request);
    this.responseHeadersSerializer = generateSerializer(this.fury, HeadersProto.Response);

    this.anySerializer = new AnyProtocolSerializer(this.writer, this.reader);
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

    writer.uint16((OperationType.Notification << 8) | ProtoVersionV1);
    writer.uint32(requestId);

    writer.stringOfVarUInt32(method);
    this.requestHeadersSerializer.write(headers);
    this.getProcessor(method).writeRequest(args);

    return writer.dump();
  }

  Request(requestId: number, method: string, headers: IRequestHeaders, args: any[]) {
    const { writer } = this;
    writer.reset();

    writer.uint16((OperationType.Request << 8) | ProtoVersionV1);
    writer.uint32(requestId);

    writer.stringOfVarUInt32(method);
    this.requestHeadersSerializer.write(headers);
    this.getProcessor(method).writeRequest(args);

    return writer.dump();
  }

  Cancel(requestId: number) {
    const { writer } = this;
    writer.reset();

    writer.uint16((OperationType.Cancel << 8) | ProtoVersionV1);
    writer.uint32(requestId);

    return writer.dump();
  }

  Response(requestId: number, method: string, headers: Record<string, any>, result: any) {
    const { writer } = this;
    writer.reset();

    writer.uint16((OperationType.Response << 8) | ProtoVersionV1);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    writer.uint16(Status.OK);
    this.responseHeadersSerializer.write(headers);
    this.getProcessor(method).writeResponse(result);

    return writer.dump();
  }

  Error(requestId: number, method: string, headers: Record<string, any>, error: any) {
    const { writer } = this;
    writer.reset();

    writer.uint16((OperationType.Response << 8) | ProtoVersionV1);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    writer.uint16(Status.Err);
    this.responseHeadersSerializer.write(headers);
    writer.stringOfVarUInt32(stringifyError(error));

    return writer.dump();
  }
}
