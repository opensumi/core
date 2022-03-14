// TODO: merge into core-common/encoding.ts

import * as fs from 'fs-extra';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

import { URI } from '@opensumi/ide-core-common';
import { SUPPORTED_ENCODINGS } from '@opensumi/ide-core-common/lib/const';
import { FileUri } from '@opensumi/ide-core-node';

import { EncodingInfo } from '../common/encoding';

export const UTF8 = 'utf8';
export const UTF8_WITH_BOM = 'utf8bom';
export const UTF16BE = 'utf16be';
export const UTF16LE = 'utf16le';
export const UTF16BE_BOM = [0xfe, 0xff];
export const UTF16LE_BOM = [0xff, 0xfe];
export const UTF8_BOM = [0xef, 0xbb, 0xbf];

function isUtf8(buffer: Buffer) {
  let i = 0;
  while (i < buffer.length) {
    if (
      // ASCII
      buffer[i] === 0x09 ||
      buffer[i] === 0x0a ||
      buffer[i] === 0x0d ||
      (0x20 <= buffer[i] && buffer[i] <= 0x7e)
    ) {
      i += 1;
      continue;
    }

    if (
      // non-overlong 2-byte
      0xc2 <= buffer[i] &&
      buffer[i] <= 0xdf &&
      0x80 <= buffer[i + 1] &&
      buffer[i + 1] <= 0xbf
    ) {
      i += 2;
      continue;
    }

    if (
      // excluding overlongs
      (buffer[i] === 0xe0 &&
        0xa0 <= buffer[i + 1] &&
        buffer[i + 1] <= 0xbf &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf) || // straight 3-byte
      (((0xe1 <= buffer[i] && buffer[i] <= 0xec) || buffer[i] === 0xee || buffer[i] === 0xef) &&
        0x80 <= buffer[i + 1] &&
        buffer[i + 1] <= 0xbf &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf) || // excluding surrogates
      (buffer[i] === 0xed &&
        0x80 <= buffer[i + 1] &&
        buffer[i + 1] <= 0x9f &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf)
    ) {
      i += 3;
      continue;
    }

    if (
      // planes 1-3
      (buffer[i] === 0xf0 &&
        0x90 <= buffer[i + 1] &&
        buffer[i + 1] <= 0xbf &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf &&
        0x80 <= buffer[i + 3] &&
        buffer[i + 3] <= 0xbf) || // planes 4-15
      (0xf1 <= buffer[i] &&
        buffer[i] <= 0xf3 &&
        0x80 <= buffer[i + 1] &&
        buffer[i + 1] <= 0xbf &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf &&
        0x80 <= buffer[i + 3] &&
        buffer[i + 3] <= 0xbf) || // plane 16
      (buffer[i] === 0xf4 &&
        0x80 <= buffer[i + 1] &&
        buffer[i + 1] <= 0x8f &&
        0x80 <= buffer[i + 2] &&
        buffer[i + 2] <= 0xbf &&
        0x80 <= buffer[i + 3] &&
        buffer[i + 3] <= 0xbf)
    ) {
      i += 4;
      continue;
    }

    return false;
  }

  return true;
}

export function detectEncodingByBOMFromBuffer(buffer: Buffer | null): string | null {
  if (!buffer || buffer.length < 2) {
    return null;
  }

  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);

  // UTF-16 BE
  if (b0 === UTF16BE_BOM[0] && b1 === UTF16BE_BOM[1]) {
    return UTF16BE;
  }

  // UTF-16 LE
  if (b0 === UTF16LE_BOM[0] && b1 === UTF16LE_BOM[1]) {
    return UTF16LE;
  }

  if (buffer.length < 3) {
    return null;
  }

  const b2 = buffer.readUInt8(2);

  // UTF-8 BOM
  if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
    return UTF8_WITH_BOM;
  }

  return null;
}

const JSCHARDET_TO_ICONV_ENCODINGS: { [name: string]: string } = {
  ibm866: 'cp866',
  big5: 'cp950',
};

export function detectEncodingByBuffer(buffer: Buffer): string | null {
  const result = detectEncodingByBOMFromBuffer(buffer);

  if (result) {
    return result;
  }

  if (isUtf8(buffer)) {
    return UTF8;
  }

  // Support encodings http://chardet.readthedocs.io/en/latest/supported-encodings.html
  const detected = jschardet.detect(buffer, { minimumThreshold: 0.2 });

  if (!detected || !detected.encoding) {
    return null;
  }
  const encoding = detected.encoding;
  const normalizedEncodingName = encoding.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];

  return mapped || normalizedEncodingName;
}

export function detectEncodingByURI(uri: URI): string | null {
  const filePath = FileUri.fsPath(uri);
  const fd = fs.openSync(filePath, 'r');
  const maxLength = 100;
  let buffer = Buffer.allocUnsafe(maxLength);
  const readLength = fs.readSync(fd, buffer, 0, maxLength, null);

  // Reset real length
  buffer = buffer.slice(0, readLength);
  fs.closeSync(fd);
  return detectEncodingByBuffer(buffer);
}

export function getEncodingInfo(encoding: string | null): null | EncodingInfo {
  if (!encoding) {
    return null;
  }
  const result = SUPPORTED_ENCODINGS[encoding] || {};

  return {
    id: encoding,
    labelLong: result.labelLong || encoding,
    labelShort: result.labelShort || encoding,
  };
}

export function decode(buffer: Buffer, encoding: string): string {
  return iconv.decode(buffer, toNodeEncoding(encoding));
}

export function encode(content: string, encoding: string, options?: { addBOM?: boolean }): Buffer {
  return iconv.encode(content, toNodeEncoding(encoding), toNodeEncodeOptions(encoding, options));
}

export function encodingExists(encoding: string): boolean {
  return iconv.encodingExists(toNodeEncoding(encoding));
}

export function decodeStream(encoding: string | null): NodeJS.ReadWriteStream {
  return iconv.decodeStream(toNodeEncoding(encoding));
}

export function encodeStream(encoding: string, options?: { addBOM?: boolean }): NodeJS.ReadWriteStream {
  return iconv.encodeStream(toNodeEncoding(encoding), toNodeEncodeOptions(encoding, options));
}

function toNodeEncoding(enc: string | null): string {
  if (enc === UTF8_WITH_BOM || enc === null) {
    return UTF8; // iconv does not distinguish UTF 8 with or without BOM, so we need to help it
  }

  return enc;
}

function toNodeEncodeOptions(encoding: string, options?: { addBOM?: boolean }) {
  return Object.assign(
    {
      // Set iconv write utf8 with bom
      addBOM: encoding === UTF8_WITH_BOM,
    },
    options,
  );
}
