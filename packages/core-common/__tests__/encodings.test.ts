import * as iconv from 'iconv-lite';

import { SUPPORTED_ENCODINGS } from '../src/const';
import { toIconvLiteEncoding, toCanonicalName, detectEncodingFromBuffer } from '../src/encoding';
import { BinaryBuffer } from '../src/utils/buffer';

const utf8BOM = [0xef, 0xbb, 0xbf];

const helloUtf8 = new Uint8Array([228, 189, 160, 229, 165, 189]);
const helloGbk = new Uint8Array([196, 227, 186, 195]);
const helloWithBOM = utf8BOM.concat(Array.from(helloUtf8));

describe('encodings', () => {
  test('iconv: encoding keys valid for iconv', () => {
    const keys = Object.keys(SUPPORTED_ENCODINGS);
    for (const encoding of keys) {
      expect(iconv.encodingExists(toIconvLiteEncoding(encoding))).toBeTruthy();
    }
  });

  test.skip('encoding keys valid for TextDecoder', () => {
    // ! 目前跑不过这个 case，原因是 node 环境的问题
    // ! RangeError [ERR_ENCODING_NOT_SUPPORTED]: The "windows-1252" encoding is not supported
    // 手动测了一下在 electron 和 web 端（chrome 89）的 console 里都是支持 windows-1252 的 encoding 的
    const keys = Object.keys(SUPPORTED_ENCODINGS);
    for (const encoding of keys) {
      expect(new TextDecoder(toCanonicalName(encoding))).toBeTruthy();
    }
  });

  test('iconv: decode gbk', () => {
    const buffer = Buffer.from(helloGbk);
    let result = iconv.decode(buffer as Buffer, 'gbk');
    expect(result).toBe('你好');

    const hello = new Uint8Array(helloGbk);
    result = iconv.decode(hello as Buffer, 'gbk');
    expect(result).toBe('你好');
  });

  test('iconv: decode utf8', () => {
    const buffer = Buffer.from(helloUtf8);
    let result = iconv.decode(buffer as Buffer, 'utf8');
    expect(result).toBe('你好');
    const hello = new Uint8Array(helloUtf8);
    result = iconv.decode(hello as Buffer, 'utf8');
    expect(result).toBe('你好');
  });

  test('iconv: test utf8bom', () => {
    const buffer = Buffer.from(helloWithBOM);
    const result = iconv.decode(buffer as Buffer, 'utf8');
    expect(result).toBe('你好');
  });

  test('guess encoding', async () => {
    const buffer = BinaryBuffer.wrap(
      Uint8Array.from([
        0xb4, 0xb0, 0xc7, 0xb0, 0xc3, 0xf7, 0xd4, 0xc2, 0xb9, 0xe2, 0x0a, 0xd2, 0xc9, 0xca, 0xc7, 0xb5, 0xd8, 0xc9,
        0xcf, 0xcb, 0xaa,
      ]),
    );
    const detectedEncoding = 'gb2312';
    expect((await detectEncodingFromBuffer(buffer, true)).encoding).toBe(detectedEncoding);
    expect(buffer.toString(detectedEncoding)).toBe('窗前明月光\n疑是地上霜');
  });
});
