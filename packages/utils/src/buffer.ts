/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UTF8, iconvDecode, toCanonicalName } from './encoding';
import * as strings from './strings';

let textEncoder: TextEncoder | null;

const isInNodeEnv =
  typeof process !== 'undefined' &&
  typeof process.versions !== 'undefined' &&
  typeof process.versions.node !== 'undefined';

const hasBuffer = isInNodeEnv && typeof Buffer !== 'undefined';
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

  static concat(buffers: (BinaryBuffer | Uint8Array)[], totalLength?: number): BinaryBuffer {
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
    this.byteLength = buffer.byteLength;
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
    return new BinaryBuffer(this.buffer.subarray(start, end));
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

/** Decodes base64 to a uint8 array. URL-encoded and unpadded base64 is allowed. */
export function decodeBase64(encoded: string) {
  let building = 0;
  let remainder = 0;
  let bufi = 0;

  // The simpler way to do this is `Uint8Array.from(atob(str), c => c.charCodeAt(0))`,
  // but that's about 10-20x slower than this function in current Chromium versions.

  const buffer = new Uint8Array(Math.floor((encoded.length / 4) * 3));
  const append = (value: number) => {
    switch (remainder) {
      case 3:
        buffer[bufi++] = building | value;
        remainder = 0;
        break;
      case 2:
        buffer[bufi++] = building | (value >>> 2);
        building = value << 6;
        remainder = 3;
        break;
      case 1:
        buffer[bufi++] = building | (value >>> 4);
        building = value << 4;
        remainder = 2;
        break;
      default:
        building = value << 2;
        remainder = 1;
    }
  };

  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i);
    // See https://datatracker.ietf.org/doc/html/rfc4648#section-4
    // This branchy code is about 3x faster than an indexOf on a base64 char string.
    if (code >= 65 && code <= 90) {
      append(code - 65); // A-Z starts ranges from char code 65 to 90
    } else if (code >= 97 && code <= 122) {
      append(code - 97 + 26); // a-z starts ranges from char code 97 to 122, starting at byte 26
    } else if (code >= 48 && code <= 57) {
      append(code - 48 + 52); // 0-9 starts ranges from char code 48 to 58, starting at byte 52
    } else if (code === 43 || code === 45) {
      append(62); // "+" or "-" for URLS
    } else if (code === 47 || code === 95) {
      append(63); // "/" or "_" for URLS
    } else if (code === 61) {
      break; // "="
    } else {
      throw new SyntaxError(`Unexpected base64 character ${encoded[i]}`);
    }
  }

  const unpadded = bufi;
  while (remainder > 0) {
    append(0);
  }

  // slice is needed to account for overestimation due to padding
  return BinaryBuffer.wrap(buffer).slice(0, unpadded);
}

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64UrlSafeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Encodes a buffer to a base64 string. */
export function encodeBase64({ buffer }: BinaryBuffer, padded = true, urlSafe = false) {
  const dictionary = urlSafe ? base64UrlSafeAlphabet : base64Alphabet;
  let output = '';

  const remainder = buffer.byteLength % 3;

  let i = 0;
  for (; i < buffer.byteLength - remainder; i += 3) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    const c = buffer[i + 2];

    output += dictionary[a >>> 2];
    output += dictionary[((a << 4) | (b >>> 4)) & 0b111111];
    output += dictionary[((b << 2) | (c >>> 6)) & 0b111111];
    output += dictionary[c & 0b111111];
  }

  if (remainder === 1) {
    const a = buffer[i + 0];
    output += dictionary[a >>> 2];
    output += dictionary[(a << 4) & 0b111111];
    if (padded) {
      output += '==';
    }
  } else if (remainder === 2) {
    const a = buffer[i + 0];
    const b = buffer[i + 1];
    output += dictionary[a >>> 2];
    output += dictionary[((a << 4) | (b >>> 4)) & 0b111111];
    output += dictionary[(b << 2) & 0b111111];
    if (padded) {
      output += '=';
    }
  }

  return output;
}

export type ITypedArray = Uint8Array | Uint16Array | Uint32Array;
export type IDataType = string | Buffer | ITypedArray;

export const getUInt8Buffer = hasBuffer
  ? (data: IDataType): Uint8Array => {
      if (typeof data === 'string') {
        const buf = Buffer.from(data, 'utf8');
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      }

      if (Buffer.isBuffer(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.length);
      }

      if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }

      throw new Error('Invalid data type!');
    }
  : (data: IDataType): Uint8Array => {
      if (typeof data === 'string') {
        if (hasTextEncoder) {
          if (!textEncoder) {
            textEncoder = new TextEncoder();
          }
          return textEncoder.encode(data);
        } else {
          return strings.encodeUTF8(data);
        }
      }

      if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }

      throw new Error('Invalid data type!');
    };
