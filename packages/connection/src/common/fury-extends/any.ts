import { BinaryReader, BinaryWriter } from '@furyjs/fury/dist/lib/type';

import { Uri, isUint8Array } from '@opensumi/ide-core-common';

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
  Null,
  Boolean,
}

export class AnySerializer {
  constructor(protected writer: BinaryWriter, protected reader: BinaryReader) {}

  write(data: any) {
    const { writer } = this;
    const type = typeof data;
    writer.reserve(1);

    switch (type) {
      case 'undefined':
        writer.uint8(ProtocolType.Undefined);
        break;
      case 'string':
        writer.uint8(ProtocolType.String);
        writer.stringOfVarUInt32(data);
        break;
      case 'boolean':
        writer.reserve(1);
        writer.uint8(ProtocolType.Boolean);
        writer.uint8(data ? 1 : 0);
        break;
      case 'number':
        writer.reserve(8);
        if ((data | 0) === data) {
          writer.uint8(ProtocolType.Int32);
          writer.int32(data);
        } else {
          writer.uint8(ProtocolType.Number);
          writer.double(data);
        }
        break;
      case 'bigint':
        writer.reserve(8);
        writer.uint8(ProtocolType.BigInt);
        writer.int64(data);
        break;
      case 'object':
        if (data === null) {
          writer.uint8(ProtocolType.Null);
        } else if (Array.isArray(data)) {
          writer.reserve(4);
          writer.uint8(ProtocolType.Array);
          writer.varUInt32(data.length);
          for (const element of data) {
            this.write(element);
          }
        } else if (isUint8Array(data)) {
          writer.reserve(4);
          writer.uint8(ProtocolType.Buffer);
          writer.varUInt32(data.byteLength);
          writer.buffer(data);
        } else {
          writer.uint8(ProtocolType.JSONObject);
          writer.stringOfVarUInt32(JSON.stringify(data));
        }
        break;
      default:
        throw new Error(`Unknown type ${type}`);
    }
  }

  read() {
    const { reader } = this;

    const type = reader.uint8();
    switch (type) {
      case ProtocolType.Undefined:
        return undefined;
      case ProtocolType.Null:
        return null;
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

enum EObjectTransferType {
  CODE_URI = 'CODE_URI',
}

class ObjectTransfer {
  static replacer(key: string | undefined, value: any) {
    if (value) {
      switch (value.$mid) {
        case 1: {
          // `$mid === 1` is defined in `monaco-editor-core/esm/vs/base/common/uri.ts`
          const uri = Uri.revive(value);
          return {
            $type: EObjectTransferType.CODE_URI,
            data: uri.toString(),
          };
        }
      }
    }

    return value;
  }
  static reviver(key: string | undefined, value: any) {
    if (value && value.$type !== undefined && value.data !== undefined) {
      switch (value.$type) {
        case EObjectTransferType.CODE_URI:
          return Uri.parse(value.data);
      }
    }
    return value;
  }
}
