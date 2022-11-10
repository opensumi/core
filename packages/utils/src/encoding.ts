/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import iconv from 'iconv-lite';

import type { BinaryBuffer } from './buffer';
import { SUPPORTED_ENCODINGS } from './const';

export const UTF8 = 'utf8';
export const UTF8_with_bom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';

export const UTF16be_BOM = [0xfe, 0xff];
export const UTF16le_BOM = [0xff, 0xfe];
export const UTF8_BOM = [0xef, 0xbb, 0xbf];

const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512; // number of bytes to look at to decide about a file being binary or not
const AUTO_ENCODING_GUESS_MAX_BYTES = 512 * 128; // set an upper limit for the number of bytes we pass on to jschardet

export function isUTF8(encoding: string | null) {
  if (encoding) {
    return toIconvLiteEncoding(encoding) === UTF8;
  }
  return false;
}

const SUPPORT_ENCODINGS_TO_ICONV_ENCODINGS: { [name: string]: string } = {
  ibm866: 'cp866',
  big5: 'cp950',
  utf8bom: 'utf8',
};

export function toIconvLiteEncoding(encodingName: string): string {
  const normalizedEncodingName = encodingName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const mapped = SUPPORT_ENCODINGS_TO_ICONV_ENCODINGS[normalizedEncodingName];

  return mapped || normalizedEncodingName;
}

/**
 * The encodings that are allowed in a settings file don't match the canonical encoding labels specified by WHATWG.
 * See https://encoding.spec.whatwg.org/#names-and-labels
 * Iconv-lite strips all non-alphanumeric characters, but ripgrep doesn't. For backcompat, allow these labels.
 */
export function toCanonicalName(enc: string): string {
  switch (enc) {
    case 'shiftjis':
      return 'shift-jis';
    case 'utf16le':
      return 'utf-16le';
    case 'utf16be':
      return 'utf-16be';
    case 'big5hkscs':
      return 'big5-hkscs';
    case 'eucjp':
      return 'euc-jp';
    case 'euckr':
      return 'euc-kr';
    case 'koi8r':
      return 'koi8-r';
    case 'koi8u':
      return 'koi8-u';
    case 'macroman':
      return 'x-mac-roman';
    case 'utf8bom':
      return 'utf8';
    default: {
      const m = enc.match(/windows(\d+)/);
      if (m) {
        return 'windows-' + m[1];
      }

      return enc;
    }
  }
}

export async function encodingExists(encoding: string): Promise<boolean> {
  return iconv.encodingExists(toNodeEncoding(encoding));
}

export function toNodeEncoding(enc: string | null): string {
  if (enc === UTF8_with_bom || enc === null) {
    return UTF8; // iconv does not distinguish UTF 8 with or without BOM, so we need to help it
  }
  return enc;
}

/**
 * nodejs 内置的 Buffer 转换编码不支持 GBK，使用第三方的 iconv-lite
 * @param buffer Uint8Array | Buffer
 * @param encoding 传入的是 SUPPORTED_ENCODINGS 已有的键值（已通过 tests case 的）
 */
export function iconvDecode(buffer: Uint8Array | Buffer, encoding: string) {
  encoding = toIconvLiteEncoding(encoding);
  return iconv.decode(buffer as Buffer, encoding);
}

export function iconvEncode(content: string, encoding: string): Uint8Array | Buffer {
  encoding = toIconvLiteEncoding(encoding);
  return iconv.encode(content, encoding);
}

function encodeLatin1(buffer: Uint8Array): string {
  let result = '';
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i]);
  }
  return result;
}

export function detectEncodingByBOMFromBuffer(
  buffer: BinaryBuffer | null,
  bytesRead: number,
): typeof UTF8_with_bom | typeof UTF16le | typeof UTF16be | null {
  if (!buffer || bytesRead < UTF16be_BOM.length) {
    return null;
  }

  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);

  // UTF-16 BE
  if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
    return UTF16be;
  }

  // UTF-16 LE
  if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
    return UTF16le;
  }

  if (bytesRead < UTF8_BOM.length) {
    return null;
  }

  const b2 = buffer.readUInt8(2);

  // UTF-8
  if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
    return UTF8_with_bom;
  }

  return null;
}

// we explicitly ignore a specific set of encodings from auto guessing
// - ASCII: we never want this encoding (most UTF-8 files would happily detect as
//          ASCII files and then you could not type non-ASCII characters anymore)
// - UTF-16: we have our own detection logic for UTF-16
// - UTF-32: we do not support this encoding in VSCode
const IGNORE_ENCODINGS = ['ascii', 'utf-16', 'utf-32'];

async function guessEncodingByBuffer(buffer: BinaryBuffer): Promise<string | null> {
  // lazy load
  const jschardet = await import('jschardet');

  // ensure to limit buffer for guessing due to https://github.com/aadsm/jschardet/issues/53
  const limitedBuffer = buffer.slice(0, AUTO_ENCODING_GUESS_MAX_BYTES);

  // before guessing jschardet calls toString('binary') on input if it is a Buffer,
  // since we are using it inside browser environment as well we do conversion ourselves
  // https://github.com/aadsm/jschardet/blob/v2.1.1/src/index.js#L36-L40
  const binaryString = encodeLatin1(limitedBuffer.buffer);

  const guessed = jschardet.detect(binaryString);
  if (!guessed || !guessed.encoding) {
    return null;
  }

  const enc = guessed.encoding.toLowerCase();
  if (0 <= IGNORE_ENCODINGS.indexOf(enc)) {
    return null; // see comment above why we ignore some encodings
  }

  return toIconvLiteEncoding(guessed.encoding);
}

export interface IDetectedEncodingResult {
  encoding: string | null;
  seemsBinary: boolean;
}

export function detectEncodingFromBuffer(buffer: BinaryBuffer, autoGuessEncoding?: false): IDetectedEncodingResult;
export function detectEncodingFromBuffer(
  buffer: BinaryBuffer,
  autoGuessEncoding?: boolean,
): Promise<IDetectedEncodingResult>;
export function detectEncodingFromBuffer(
  buffer: BinaryBuffer,
  autoGuessEncoding?: boolean,
): Promise<IDetectedEncodingResult> | IDetectedEncodingResult {
  const bytesRead = buffer.byteLength;
  // Always first check for BOM to find out about encoding
  let encoding = detectEncodingByBOMFromBuffer(buffer, bytesRead);

  // Detect 0 bytes to see if file is binary or UTF-16 LE/BE
  // unless we already know that this file has a UTF-16 encoding
  let seemsBinary = false;
  if (encoding !== UTF16be && encoding !== UTF16le && buffer) {
    let couldBeUTF16LE = true; // e.g. 0xAA 0x00
    let couldBeUTF16BE = true; // e.g. 0x00 0xAA
    let containsZeroByte = false;

    // This is a simplified guess to detect UTF-16 BE or LE by just checking if
    // the first 512 bytes have the 0-byte at a specific location. For UTF-16 LE
    // this would be the odd byte index and for UTF-16 BE the even one.
    // Note: this can produce false positives (a binary file that uses a 2-byte
    // encoding of the same format as UTF-16) and false negatives (a UTF-16 file
    // that is using 4 bytes to encode a character).
    for (let i = 0; i < bytesRead && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
      const isEndian = i % 2 === 1; // assume 2-byte sequences typical for UTF-16
      const isZeroByte = buffer.readUInt8(i) === 0;

      if (isZeroByte) {
        containsZeroByte = true;
      }

      // UTF-16 LE: expect e.g. 0xAA 0x00
      if (couldBeUTF16LE && ((isEndian && !isZeroByte) || (!isEndian && isZeroByte))) {
        couldBeUTF16LE = false;
      }

      // UTF-16 BE: expect e.g. 0x00 0xAA
      if (couldBeUTF16BE && ((isEndian && isZeroByte) || (!isEndian && !isZeroByte))) {
        couldBeUTF16BE = false;
      }

      // Return if this is neither UTF16-LE nor UTF16-BE and thus treat as binary
      if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
        break;
      }
    }

    // Handle case of 0-byte included
    if (containsZeroByte) {
      if (couldBeUTF16LE) {
        encoding = UTF16le;
      } else if (couldBeUTF16BE) {
        encoding = UTF16be;
      } else {
        seemsBinary = true;
      }
    }
  }

  // Auto guess encoding if configured
  if (autoGuessEncoding && !seemsBinary && !encoding && buffer) {
    return guessEncodingByBuffer(buffer.slice(0, bytesRead)).then((guessedEncoding) => ({
      seemsBinary: false,
      encoding: guessedEncoding,
    }));
  }

  return { seemsBinary, encoding };
}

export interface IEncodingInfo {
  id: string; // encoding identifier
  labelLong: string; // long label name
  labelShort: string; // short label name
}

export function getEncodingInfo(encoding: string | null): null | IEncodingInfo {
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
