import * as jschardet from 'jschardet';
import { EncodingInfo } from '../common/encoding';

function detectEncodingByBOM(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 2) {
    return null;
  }

  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);

  // UTF-16 BE
  if (b0 === 0xFE && b1 === 0xFF) {
    return 'utf16be';
  }

  // UTF-16 LE
  if (b0 === 0xFF && b1 === 0xFE) {
    return 'utf16le';
  }

  if (buffer.length < 3) {
    return null;
  }

  const b2 = buffer.readUInt8(2);

  // UTF-8
  if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
    return 'utf8';
  }

  return null;
}

const IGNORE_ENCODINGS = [
  'ascii',
  'utf-8',
  'utf-16',
  'utf-32',
];

const JSCHARDET_TO_ICONV_ENCODINGS: { [name: string]: string } = {
  'ibm866': 'cp866',
  'big5': 'cp950',
};

export function detectEncoding(buffer: Buffer): string | null {
  const result = detectEncodingByBOM(buffer);

  if (result) {
    return result;
  }

  const detected = jschardet.detect(buffer, { minimumThreshold: 0 });

  if (!detected || !detected.encoding) {
    return null;
  }

  const encoding = detected.encoding;

  // Ignore encodings that cannot guess correctly
  // (http://chardet.readthedocs.io/en/latest/supported-encodings.html)
  if (0 <= IGNORE_ENCODINGS.indexOf(encoding.toLowerCase())) {
    return null;
  }

  const normalizedEncodingName = encoding.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];

  return mapped || normalizedEncodingName;
}

export function detectEncodingInfo(buffer: Buffer): null | EncodingInfo {
  const encoding = detectEncoding(buffer);
  return getEncodingInfo(encoding);
}

export function getEncodingInfo(encoding: string | null): null | EncodingInfo {
  if (!encoding) {
    return null;
  }
  const result = SUPPORTED_ENCODINGS[encoding] || {};

  return {
    value: encoding,
    labelLong: result.labelLong || encoding,
    labelShort: result.labelShort || encoding,
  };
}

export const SUPPORTED_ENCODINGS: { [encoding: string]: { labelLong: string; labelShort: string; order: number; encodeOnly?: boolean; alias?: string } } = {
  utf8: {
    labelLong: 'UTF-8',
    labelShort: 'UTF-8',
    order: 1,
    alias: 'utf8bom',
  },
  utf8bom: {
    labelLong: 'UTF-8 with BOM',
    labelShort: 'UTF-8 with BOM',
    encodeOnly: true,
    order: 2,
    alias: 'utf8',
  },
  utf16le: {
    labelLong: 'UTF-16 LE',
    labelShort: 'UTF-16 LE',
    order: 3,
  },
  utf16be: {
    labelLong: 'UTF-16 BE',
    labelShort: 'UTF-16 BE',
    order: 4,
  },
  windows1252: {
    labelLong: 'Western (Windows 1252)',
    labelShort: 'Windows 1252',
    order: 5,
  },
  iso88591: {
    labelLong: 'Western (ISO 8859-1)',
    labelShort: 'ISO 8859-1',
    order: 6,
  },
  iso88593: {
    labelLong: 'Western (ISO 8859-3)',
    labelShort: 'ISO 8859-3',
    order: 7,
  },
  iso885915: {
    labelLong: 'Western (ISO 8859-15)',
    labelShort: 'ISO 8859-15',
    order: 8,
  },
  macroman: {
    labelLong: 'Western (Mac Roman)',
    labelShort: 'Mac Roman',
    order: 9,
  },
  cp437: {
    labelLong: 'DOS (CP 437)',
    labelShort: 'CP437',
    order: 10,
  },
  windows1256: {
    labelLong: 'Arabic (Windows 1256)',
    labelShort: 'Windows 1256',
    order: 11,
  },
  iso88596: {
    labelLong: 'Arabic (ISO 8859-6)',
    labelShort: 'ISO 8859-6',
    order: 12,
  },
  windows1257: {
    labelLong: 'Baltic (Windows 1257)',
    labelShort: 'Windows 1257',
    order: 13,
  },
  iso88594: {
    labelLong: 'Baltic (ISO 8859-4)',
    labelShort: 'ISO 8859-4',
    order: 14,
  },
  iso885914: {
    labelLong: 'Celtic (ISO 8859-14)',
    labelShort: 'ISO 8859-14',
    order: 15,
  },
  windows1250: {
    labelLong: 'Central European (Windows 1250)',
    labelShort: 'Windows 1250',
    order: 16,
  },
  iso88592: {
    labelLong: 'Central European (ISO 8859-2)',
    labelShort: 'ISO 8859-2',
    order: 17,
  },
  cp852: {
    labelLong: 'Central European (CP 852)',
    labelShort: 'CP 852',
    order: 18,
  },
  windows1251: {
    labelLong: 'Cyrillic (Windows 1251)',
    labelShort: 'Windows 1251',
    order: 19,
  },
  cp866: {
    labelLong: 'Cyrillic (CP 866)',
    labelShort: 'CP 866',
    order: 20,
  },
  iso88595: {
    labelLong: 'Cyrillic (ISO 8859-5)',
    labelShort: 'ISO 8859-5',
    order: 21,
  },
  koi8r: {
    labelLong: 'Cyrillic (KOI8-R)',
    labelShort: 'KOI8-R',
    order: 22,
  },
  koi8u: {
    labelLong: 'Cyrillic (KOI8-U)',
    labelShort: 'KOI8-U',
    order: 23,
  },
  iso885913: {
    labelLong: 'Estonian (ISO 8859-13)',
    labelShort: 'ISO 8859-13',
    order: 24,
  },
  windows1253: {
    labelLong: 'Greek (Windows 1253)',
    labelShort: 'Windows 1253',
    order: 25,
  },
  iso88597: {
    labelLong: 'Greek (ISO 8859-7)',
    labelShort: 'ISO 8859-7',
    order: 26,
  },
  windows1255: {
    labelLong: 'Hebrew (Windows 1255)',
    labelShort: 'Windows 1255',
    order: 27,
  },
  iso88598: {
    labelLong: 'Hebrew (ISO 8859-8)',
    labelShort: 'ISO 8859-8',
    order: 28,
  },
  iso885910: {
    labelLong: 'Nordic (ISO 8859-10)',
    labelShort: 'ISO 8859-10',
    order: 29,
  },
  iso885916: {
    labelLong: 'Romanian (ISO 8859-16)',
    labelShort: 'ISO 8859-16',
    order: 30,
  },
  windows1254: {
    labelLong: 'Turkish (Windows 1254)',
    labelShort: 'Windows 1254',
    order: 31,
  },
  iso88599: {
    labelLong: 'Turkish (ISO 8859-9)',
    labelShort: 'ISO 8859-9',
    order: 32,
  },
  windows1258: {
    labelLong: 'Vietnamese (Windows 1258)',
    labelShort: 'Windows 1258',
    order: 33,
  },
  gbk: {
    labelLong: 'Simplified Chinese (GBK)',
    labelShort: 'GBK',
    order: 34,
  },
  gb18030: {
    labelLong: 'Simplified Chinese (GB18030)',
    labelShort: 'GB18030',
    order: 35,
  },
  cp950: {
    labelLong: 'Traditional Chinese (Big5)',
    labelShort: 'Big5',
    order: 36,
  },
  big5hkscs: {
    labelLong: 'Traditional Chinese (Big5-HKSCS)',
    labelShort: 'Big5-HKSCS',
    order: 37,
  },
  shiftjis: {
    labelLong: 'Japanese (Shift JIS)',
    labelShort: 'Shift JIS',
    order: 38,
  },
  eucjp: {
    labelLong: 'Japanese (EUC-JP)',
    labelShort: 'EUC-JP',
    order: 39,
  },
  euckr: {
    labelLong: 'Korean (EUC-KR)',
    labelShort: 'EUC-KR',
    order: 40,
  },
  windows874: {
    labelLong: 'Thai (Windows 874)',
    labelShort: 'Windows 874',
    order: 41,
  },
  iso885911: {
    labelLong: 'Latin/Thai (ISO 8859-11)',
    labelShort: 'ISO 8859-11',
    order: 42,
  },
  koi8ru: {
    labelLong: 'Cyrillic (KOI8-RU)',
    labelShort: 'KOI8-RU',
    order: 43,
  },
  koi8t: {
    labelLong: 'Tajik (KOI8-T)',
    labelShort: 'KOI8-T',
    order: 44,
  },
  gb2312: {
    labelLong: 'Simplified Chinese (GB 2312)',
    labelShort: 'GB 2312',
    order: 45,
  },
  cp865: {
    labelLong: 'Nordic DOS (CP 865)',
    labelShort: 'CP 865',
    order: 46,
  },
  cp850: {
    labelLong: 'Western European DOS (CP 850)',
    labelShort: 'CP 850',
    order: 47,
  },
};
