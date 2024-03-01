import Fury, { Serializer, Type, TypeDescription } from '@furyjs/fury';
import { generateSerializer } from '@furyjs/fury/dist/lib/gen';
import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { stringifyError } from '@opensumi/ide-core-common/lib/utils';

import { AnySerializer } from '../fury-extends/any';
import { furyFactory } from '../fury-extends/shared';

import {
  IProtocolProcessor,
  IRequestHeaders,
  IResponseHeaders,
  ITransferable,
  TRequestTransferable,
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

const requestHeadersProto = Type.object('req-headers', {
  cancelable: Type.bool(),
});

export const responseHeadersProto = Type.object('resp-headers', {
  chunked: Type.bool(),
});

const createTransferable = (name: string, type?: TypeDescription) => {
  const props = {
    $: Type.string(),
  } as Record<string, TypeDescription>;
  if (type) {
    props.r = type;
  }
  return Type.object(name, props);
};

class SumiProtocolProcessor implements IProtocolProcessor {
  request: TSerializer;
  result: TSerializer;
  requestArgsLength: number;

  constructor(methodProtocol: TSumiProtocolMethod, public fury: Fury) {
    const methodName = methodProtocol.method;

    const argsTuple = [] as TypeDescription[];

    for (const element of methodProtocol.request) {
      argsTuple.push(createTransferable(methodName + '^' + element.name, element.type));
    }

    const requestProto = Type.tuple(argsTuple);
    const resultProto = createTransferable(methodName + 'v', methodProtocol.response.type);

    this.requestArgsLength = argsTuple.length;

    this.request = this.fury.registerSerializer(requestProto);
    this.result = this.fury.registerSerializer(resultProto);
  }
  writeRequest(args: any[]): void {
    const newArray: TRequestTransferable = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = ObjectTransfer.replacer(args[i]);
    }

    return this.request.serializer.write(newArray);
  }
  readRequest(): any[] {
    const result = new Array(this.requestArgsLength);
    const argsArray = this.request.serializer.read() as TRequestTransferable;
    for (let i = 0; i < this.requestArgsLength; i++) {
      result[i] = ObjectTransfer.reviver(argsArray[i]);
    }
    return result;
  }
  writeResponse<T = any>(result: T): void {
    return this.result.serializer.write(ObjectTransfer.replacer(result));
  }
  readResponse<T = any>(): T {
    const payload = this.result.serializer.read() as ITransferable;
    return ObjectTransfer.reviver(payload);
  }

  serializeRequest(args: any[]): Uint8Array {
    const newArray: TRequestTransferable = new Array(args.length);
    for (let i = 0; i < args.length; i++) {
      newArray[i] = ObjectTransfer.replacer(args[i]);
    }

    return this.request.serialize(newArray);
  }

  deserializeRequest(buffer: Uint8Array): any[] {
    const result = new Array(this.requestArgsLength);
    const argsArray = this.request.deserialize(buffer) as TRequestTransferable;
    for (let i = 0; i < this.requestArgsLength; i++) {
      result[i] = ObjectTransfer.reviver(argsArray[i]);
    }
    return result;
  }

  serializeResult<T = any>(result: T): Uint8Array {
    return this.result.serialize(ObjectTransfer.replacer(result));
  }

  deserializeResult<T = any>(buffer: Uint8Array): T {
    const payload = this.result.deserialize(buffer) as ITransferable;
    return ObjectTransfer.reviver(payload);
  }
}

class AnyProtocolProcessor implements IProtocolProcessor {
  anySerializer: AnySerializer;

  constructor(public writer: BinaryWriter, public reader: BinaryReader) {
    this.anySerializer = new AnySerializer(this.writer, this.reader);
  }

  writeRequest(args: any[]): void {
    this.anySerializer.serializeWorker(args);
  }
  readRequest(): any[] {
    return this.anySerializer.deserializeWorker();
  }
  writeResponse<T = any>(result: T): void {
    this.anySerializer.serializeWorker(result);
  }
  readResponse<T = any>(): T {
    return this.anySerializer.deserializeWorker();
  }

  serializeRequest(args: any[]): Uint8Array {
    return this.anySerializer.serialize(args);
  }

  deserializeRequest(buffer: Uint8Array): any[] {
    return this.anySerializer.deserialize(buffer);
  }

  serializeResult<T = any>(result: T): Uint8Array {
    return this.anySerializer.serialize(result);
  }

  deserializeResult<T = any>(buffer: Uint8Array): T {
    return this.anySerializer.deserialize(buffer);
  }
}

export class ProtocolRepository {
  fury: Fury;
  reader: BinaryReader;
  writer: BinaryWriter;

  private processorMap = new Map<string, SumiProtocolProcessor>();

  private anyProcessor: AnyProtocolProcessor;

  requestHeadersSerializer: Serializer<IRequestHeaders, IRequestHeaders>;
  responseHeadersSerializer: Serializer<IResponseHeaders, IRequestHeaders>;

  constructor() {
    const fury = furyFactory();
    this.fury = fury.fury;
    this.reader = fury.reader;
    this.writer = fury.writer;

    this.requestHeadersSerializer = generateSerializer(this.fury, requestHeadersProto);
    this.responseHeadersSerializer = generateSerializer(this.fury, responseHeadersProto);

    this.anyProcessor = new AnyProtocolProcessor(this.writer, this.reader);
  }

  has(name: string) {
    return this.processorMap.has(name);
  }

  loadProtocol(
    protocol: TSumiProtocol,
    options?: {
      nameConverter?: (str: string) => string;
    },
  ) {
    const { methods } = protocol;

    for (const proto of methods) {
      let method = proto.method;
      if (options?.nameConverter) {
        method = options.nameConverter(method);
      }

      const copy = {
        ...proto,
        method,
      };

      this.loadProtocolMethod(copy);
    }
  }

  loadProtocolMethod(methodProtocol: TSumiProtocolMethod) {
    this.processorMap.set(methodProtocol.method, new SumiProtocolProcessor(methodProtocol, this.fury));
  }

  getProcessor(method: string): IProtocolProcessor {
    const processor = this.processorMap.get(method);
    if (processor) {
      return processor;
    }
    return this.anyProcessor;
  }

  Request(requestId: number, opType: number, method: string, headers: IRequestHeaders, args: any[]) {
    const { writer } = this;
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(opType);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    this.requestHeadersSerializer.write(headers);
    this.getProcessor(method).writeRequest(args);

    return writer.dump();
  }

  Cancel(requestId: number) {
    const { writer } = this;
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Cancel);
    writer.uint32(requestId);

    return writer.dump();
  }

  Response(requestId: number, method: string, headers: Record<string, any>, result: any) {
    const { writer } = this;
    writer.reset();

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Response);
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

    writer.uint8(ProtoVersionV1);
    writer.uint8(OperationType.Response);
    writer.uint32(requestId);
    writer.stringOfVarUInt32(method);
    writer.uint16(Status.Err);
    this.responseHeadersSerializer.write(headers);
    writer.stringOfVarUInt32(stringifyError(error));

    return writer.dump();
  }
}

class ObjectTransfer {
  static TypeUndefined = '$undefined';

  static replacer(value: any) {
    const payload = {} as ITransferable;

    if (typeof value === 'undefined') {
      payload.$ = ObjectTransfer.TypeUndefined;
    }

    if (!payload.$) {
      payload.r = value;
    }

    return payload;
  }

  static reviver(transferable: ITransferable): any {
    if (transferable.$ === ObjectTransfer.TypeUndefined) {
      return undefined;
    }

    return transferable.r;
  }
}
