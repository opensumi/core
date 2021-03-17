import { SUPPORTED_ENCODINGS } from "../src/const"
import { toIconvLiteEncoding, toCanonicalName } from "../src/encoding"
import * as iconv from "iconv-lite";

const utf8BOM = [0xEF, 0xBB, 0xBF]

const helloUtf8 = new Uint8Array([ 228, 189, 160, 229, 165, 189 ]);
const helloGbk = new Uint8Array([196, 227, 186, 195]);
const helloWithBOM = utf8BOM.concat(Array.from(helloUtf8));


describe('encodings', () => {
  test('iconv: encoding keys valid for iconv', () => {
    const keys = Object.keys(SUPPORTED_ENCODINGS);
    for(const encoding of keys) {
       expect(iconv.encodingExists(toIconvLiteEncoding(encoding))).toBeTruthy()
    }
  });

  test.skip('encoding keys valid for TextDecoder', () => {
    // ! 目前跑不过这个 case，原因是 node 环境的问题
    // ! RangeError [ERR_ENCODING_NOT_SUPPORTED]: The "windows-1252" encoding is not supported
    // 手动测了一下在 electron 和 web 端（chrome 89）的 console 里都是支持 windows-1252 的 encoding 的
    const keys = Object.keys(SUPPORTED_ENCODINGS);
    for(const encoding of keys) {
       expect(new TextDecoder(toCanonicalName(encoding))).toBeTruthy()
    }
  });

  test('iconv: decode gbk', () => {
    const buffer = Buffer.from(helloGbk);
    let result = iconv.decode(buffer as Buffer, "gbk");
    expect(result).toBe("你好");

    const hello = new Uint8Array(helloGbk);
    result = iconv.decode(hello as Buffer, "gbk");
    expect(result).toBe("你好");
  });

  test('iconv: decode utf8', () => {
    const buffer = Buffer.from(helloUtf8);
    let result = iconv.decode(buffer as Buffer, "utf8");
    expect(result).toBe("你好");
    const hello = new Uint8Array(helloUtf8);
    result = iconv.decode(hello as Buffer, "utf8");
    expect(result).toBe("你好");
  });

  test('iconv: test utf8bom', () => {
    const buffer = Buffer.from(helloWithBOM);
    let result = iconv.decode(buffer as Buffer, "utf8");
    expect(result).toBe("你好");
  });
});
