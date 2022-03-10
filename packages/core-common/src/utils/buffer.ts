/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/arrays.ts

import { toCanonicalName, iconvDecode, UTF8 } from '../encoding';

import * as strings from './strings';

let textEncoder: TextEncoder | null;

const hasBuffer = typeof Buffer !== 'undefined';
const hasTextEncoder = typeof TextEncoder !== 'undefined';
const hasTextDecoder = typeof TextDecoder !== 'undefined';

export class BinaryBuffer {
  static alloc(byteLength: number): BinaryBuffer {
    if (hasBuffer) {
      return new BinaryBuffer(Buffer.allocUnsafe(byteLength));
    } else {
      return new BinaryBuffer(new Uint8Array(byteLength));
    }
  }

  static wrap(actual: Uint8Array): BinaryBuffer {
    if (hasBuffer && !Buffer.isBuffer(actual)) {
      // https://nodejs.org/dist/latest-v10.x/docs/api/buffer.html#buffer_class_method_buffer_from_arraybuffer_byteoffset_length
      // Create a zero-copy Buffer wrapper around the ArrayBuffer pointed to by the Uint8Array
      actual = Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
    }
    return new BinaryBuffer(actual);
  }

  /**
   * fromString 产生的 BinaryBuffer 的 encoding 都是 utf8
   * @param source source string
   */
  static fromString(source: string): BinaryBuffer {
    if (hasBuffer) {
      return new BinaryBuffer(Buffer.from(source));
    } else if (hasTextEncoder) {
      if (!textEncoder) {
        textEncoder = new TextEncoder();
      }
      return new BinaryBuffer(textEncoder.encode(source));
    } else {
      return new BinaryBuffer(strings.encodeUTF8(source));
    }
  }

  static concat(buffers: BinaryBuffer[], totalLength?: number): BinaryBuffer {
    if (typeof totalLength === 'undefined') {
      totalLength = 0;
      for (let i = 0, len = buffers.length; i < len; i++) {
        totalLength += buffers[i].byteLength;
      }
    }

    const ret = BinaryBuffer.alloc(totalLength);
    let offset = 0;
    for (let i = 0, len = buffers.length; i < len; i++) {
      const element = buffers[i];
      ret.set(element, offset);
      offset += element.byteLength;
    }

    return ret;
  }

  readonly buffer: Uint8Array;
  readonly byteLength: number;

  private constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.byteLength = this.buffer.byteLength;
  }

  /**
   * 将 BinaryBuffer 转为字符串
   * @param encoding 字节编码，不传默认为 utf8。需要传入 `SUPPORTED_ENCODINGS` 已有的键值。
   */
  toString(encoding?: string): string {
    if (hasBuffer) {
      // 可能原生 toString 比 iconv.decode 要快
      if (encoding === undefined || encoding === 'utf8') {
        return (this.buffer as Buffer).toString();
      }
      return iconvDecode(this.buffer as Buffer, encoding);
    } else if (hasTextDecoder) {
      encoding = toCanonicalName(encoding || UTF8);
      return new TextDecoder(encoding).decode(this.buffer);
    } else {
      return strings.decodeUTF8(this.buffer);
    }
  }

  slice(start?: number, end?: number): BinaryBuffer {
    // IMPORTANT: use subarray instead of slice because TypedArray#slice
    // creates shallow copy and NodeBuffer#slice doesn't. The use of subarray
    // ensures the same, performant, behaviour.
    return new BinaryBuffer(this.buffer.subarray(start! /* bad lib.d.ts*/, end));
  }

  set(array: BinaryBuffer | Uint8Array, offset?: number): void {
    if (array instanceof BinaryBuffer) {
      this.buffer.set(array.buffer, offset);
    } else {
      this.buffer.set(array, offset);
    }
  }

  readUInt32BE(offset: number): number {
    return readUInt32BE(this.buffer, offset);
  }

  writeUInt32BE(value: number, offset: number): void {
    writeUInt32BE(this.buffer, value, offset);
  }

  readUInt32LE(offset: number): number {
    return readUInt32LE(this.buffer, offset);
  }

  writeUInt32LE(value: number, offset: number): void {
    writeUInt32LE(this.buffer, value, offset);
  }

  readUInt8(offset: number): number {
    return readUInt8(this.buffer, offset);
  }

  writeUInt8(value: number, offset: number): void {
    writeUInt8(this.buffer, value, offset);
  }
}

export function readUInt16LE(source: Uint8Array, offset: number): number {
  return ((source[offset + 0] << 0) >>> 0) | ((source[offset + 1] << 8) >>> 0);
}

export function writeUInt16LE(destination: Uint8Array, value: number, offset: number): void {
  destination[offset + 0] = value & 0b11111111;
  value = value >>> 8;
  destination[offset + 1] = value & 0b11111111;
}

export function readUInt32BE(source: Uint8Array, offset: number): number {
  return source[offset] * 2 ** 24 + source[offset + 1] * 2 ** 16 + source[offset + 2] * 2 ** 8 + source[offset + 3];
}

export function writeUInt32BE(destination: Uint8Array, value: number, offset: number): void {
  destination[offset + 3] = value;
  value = value >>> 8;
  destination[offset + 2] = value;
  value = value >>> 8;
  destination[offset + 1] = value;
  value = value >>> 8;
  destination[offset] = value;
}

export function readUInt32LE(source: Uint8Array, offset: number): number {
  return (
    ((source[offset + 0] << 0) >>> 0) |
    ((source[offset + 1] << 8) >>> 0) |
    ((source[offset + 2] << 16) >>> 0) |
    ((source[offset + 3] << 24) >>> 0)
  );
}

export function writeUInt32LE(destination: Uint8Array, value: number, offset: number): void {
  destination[offset + 0] = value & 0b11111111;
  value = value >>> 8;
  destination[offset + 1] = value & 0b11111111;
  value = value >>> 8;
  destination[offset + 2] = value & 0b11111111;
  value = value >>> 8;
  destination[offset + 3] = value & 0b11111111;
}

export function readUInt8(source: Uint8Array, offset: number): number {
  return source[offset];
}

export function writeUInt8(destination: Uint8Array, value: number, offset: number): void {
  destination[offset] = value;
}
