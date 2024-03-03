import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { Uri, UriComponents, isUint8Array } from '@opensumi/ide-core-common';

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

export class AnySerializer {
  constructor(protected writer: BinaryWriter, protected reader: BinaryReader) {}

  write(data: unknown) {
    const { writer } = this;
    if (typeof data === 'undefined') {
      writer.uint8(ProtocolType.Undefined);
    } else if (Array.isArray(data)) {
      writer.uint8(ProtocolType.Array);
      writer.varUInt32(data.length);
      for (const element of data) {
        this.write(element);
      }
    } else if (typeof data === 'boolean') {
      writer.uint8(ProtocolType.Boolean);
      writer.uint8(data ? 1 : 0);
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
    } else if (isUint8Array(data)) {
      writer.uint8(ProtocolType.Buffer);
      writer.varUInt32(data.byteLength);
      writer.buffer(data);
    } else if (typeof data === 'bigint') {
      writer.uint8(ProtocolType.BigInt);
      writer.int64(data);
    } else if (typeof data === 'object') {
      writer.uint8(ProtocolType.JSONObject);
      writer.stringOfVarUInt32(JSON.stringify(data, ObjectTransfer.replacer));
    } else {
      throw new Error(`Unknown type ${typeof data}`);
    }
  }

  read() {
    const { reader } = this;

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
        return JSON.parse(json, ObjectTransfer.reviver);
      }
      case ProtocolType.BigInt:
        return reader.int64();
      case ProtocolType.Array: {
        const length = reader.varUInt32();
        const data = [] as unknown[];
        for (let i = 0; i < length; i++) {
          data.push(this.read());
        }
        return data;
      }
      case ProtocolType.Boolean:
        return reader.uint8() === 1;
      default:
        throw new Error(`Unknown type ${type}`);
    }
  }

  deserialize = (bytes: Uint8Array) => {
    this.reader.reset(bytes);
    return this.read();
  };

  serialize = (v: any) => {
    this.writer.reset();
    this.write(v);

    return this.writer.dump();
  };
}

class ObjectTransfer {
  static replacer(key: string | undefined, value: any) {
    return value;
  }
  static reviver(key: string | undefined, value: any) {
    if (value && value.$mid !== undefined) {
      // `$mid === 1` is defined in `vscode-uri` package
      switch (value.$mid) {
        case 1:
          return Uri.revive(value as UriComponents);
      }
    }
    return value;
  }
}
