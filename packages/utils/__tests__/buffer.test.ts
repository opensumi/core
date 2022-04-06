import { BinaryBuffer } from '../src/buffer';

const utf8BOM = [0xef, 0xbb, 0xbf];

const helloUtf8 = new Uint8Array([228, 189, 160, 229, 165, 189]);
const helloGbk = new Uint8Array([196, 227, 186, 195]);
const helloWithBOM = new Uint8Array(utf8BOM.concat(Array.from(helloUtf8)));

const _globalThis = Function('return this');
const _Buffer = Buffer;

// 两组 test
// 一组是执行正常逻辑（hasBuffer 为 true），使用 iconv 解码。
// 第二组是禁用 Buffer，让代码走另一个逻辑，使用 TextDecoder 解码。

describe('test BinaryBuffer', () => {
  test('normal: fromString', () => {
    const result = BinaryBuffer.fromString('你好');
    expect(result.toString()).toBe('你好');
  });

  test('normal: wrap utf8', () => {
    const result = BinaryBuffer.wrap(helloUtf8);
    expect(result.toString()).toBe('你好');
  });

  test('normal: wrap utf8bom', () => {
    const result = BinaryBuffer.wrap(helloWithBOM);
    expect(result.toString('utf8bom')).toBe('你好');
  });

  test('normal: wrap gbk', () => {
    const result = BinaryBuffer.wrap(helloGbk);
    expect(result.toString('gbk')).toBe('你好');
  });

  test('disable Buffer: fromString', () => {
    (_globalThis as any).Buffer = undefined;
    jest.resetModules();
    const { BinaryBuffer } = require('../src/buffer');
    const result = BinaryBuffer.fromString('你好');
    expect(result.toString('utf8bom')).toBe('你好');
    (_globalThis as any).Buffer = _Buffer;
  });

  test('disable Buffer: wrap utf8', () => {
    (_globalThis as any).Buffer = undefined;
    jest.resetModules();
    const { BinaryBuffer } = require('../src/buffer');
    const result = BinaryBuffer.wrap(helloUtf8);
    expect(result.toString()).toBe('你好');
    (_globalThis as any).Buffer = _Buffer;
  });

  test('disable Buffer: wrap utf8bom', () => {
    (_globalThis as any).Buffer = undefined;
    jest.resetModules();
    const { BinaryBuffer } = require('../src/buffer');
    const result = BinaryBuffer.wrap(helloWithBOM);
    expect(result.toString('utf8bom')).toBe('你好');
    (_globalThis as any).Buffer = _Buffer;
  });

  test.skip('disable Buffer: wrap gbk', () => {
    // ! 目前跑不过这个 case，原因是 node 环境的问题
    // ! RangeError [ERR_ENCODING_NOT_SUPPORTED]: The "gbk" encoding is not supported
    // 手动测了一下在 electron 和 web 端（chrome 89）的 console 里都是支持 gbk 的 encoding 的
    // 而且在 web 端 hasBuffer 也是为 true 的，这是一个边缘 case
    (_globalThis as any).Buffer = undefined;
    jest.resetModules();
    const { BinaryBuffer } = require('../src/buffer');
    const result = BinaryBuffer.wrap(helloGbk);
    expect(result.toString('gbk')).toBe('你好');
    (_globalThis as any).Buffer = _Buffer;
  });
});
