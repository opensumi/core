import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { reader, writer } from './shared';

export enum ProtocolType {
  String,
  Buffer,
  Number,
  Int32,
  JSONObject,
  BigInt,
  Array,
  Union,
  Object,
  Undefined,
  Boolean,
}

function serializeWorker(data: unknown, writer: BinaryWriter) {
  if (typeof data === 'undefined') {
    writer.uint8(ProtocolType.Undefined);
  } else if (typeof data === 'boolean') {
    writer.uint8(ProtocolType.Boolean);
    writer.uint8(data ? 1 : 0);
  } else if (typeof data === 'bigint') {
    writer.uint8(ProtocolType.BigInt);
    writer.int64(data);
  } else if (typeof data === 'number') {
    if ((data | 0) === data) {
      writer.uint8(ProtocolType.Int32);
      writer.int32(data);
    } else {
      writer.uint8(ProtocolType.Number);
      writer.double(data);
    }
  } else if (typeof data === 'string') {
    writer.uint8(ProtocolType.String);
    writer.stringOfVarUInt32(data);
  } else if (Buffer.isBuffer(data)) {
    writer.uint8(ProtocolType.Buffer);
    writer.varUInt32(data.byteLength);
    writer.buffer(data);
  } else if (Array.isArray(data)) {
    writer.uint8(ProtocolType.Array);
    writer.varUInt32(data.length);
    for (const element of data) {
      serializeWorker(element, writer);
    }
  } else if (typeof data === 'object') {
    writer.uint8(ProtocolType.JSONObject);
    writer.stringOfVarUInt32(JSON.stringify(data));
  }
}

function deserializeWorker(reader: BinaryReader) {
  const type = reader.uint8();
  switch (type) {
    case ProtocolType.Undefined:
      return undefined;
    case ProtocolType.String:
      return reader.stringOfVarUInt32();
    case ProtocolType.Buffer: {
      const length = reader.varUInt32();
      return reader.buffer(length);
    }
    case ProtocolType.Int32:
      return reader.int32();
    case ProtocolType.Number:
      return reader.double();
    case ProtocolType.JSONObject: {
      const json = reader.stringOfVarUInt32();
      return JSON.parse(json);
    }
    case ProtocolType.BigInt:
      return reader.int64();
    case ProtocolType.Array: {
      const length = reader.varUInt32();
      const data = [] as unknown[];
      for (let i = 0; i < length; i++) {
        data.push(deserializeWorker(reader));
      }
      return data;
    }
    case ProtocolType.Boolean:
      return reader.uint8() === 1;
    default:
      throw new Error(`Unknown type ${type}`);
  }
}

const deserialize = (bytes: Uint8Array) => {
  reader.reset(bytes);
  return deserializeWorker(reader);
};

const serializeVolatile = (v: any) => {
  writer.reset();
  serializeWorker(v, writer);

  return writer.dumpAndOwn();
};

const serialize = (v: any) => {
  writer.reset();
  serializeWorker(v, writer);

  return writer.dump();
};

export const anySerializer = {
  deserialize,
  serialize,
  serializeVolatile,
};
