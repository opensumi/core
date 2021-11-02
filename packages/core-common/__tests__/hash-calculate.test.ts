import { Injectable, Injector } from '@ali/common-di';

import { IHashCalculateService, HashCalculateServiceImpl } from '../src/hash-calculate/hash-calculate';

describe('HashCalculate', () => {
  let injector: Injector = new Injector([
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
  ]);
  let hashCalculateService: IHashCalculateService = injector.get(IHashCalculateService);

  it('HashCalculateService should be initialized', async () => {
    await hashCalculateService.initialize();
    expect(hashCalculateService['initialized']).toBeTruthy();
    expect(hashCalculateService['cachedCalculator']).toBeDefined();
  });

  it('HashCalculateService calculate simple string', () => {
    expect(hashCalculateService.calculate('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hashCalculateService.calculate('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(hashCalculateService.calculate('a\x00')).toBe('4144e195f46de78a3623da7364d04f11');
    expect(hashCalculateService.calculate('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(hashCalculateService.calculate('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(hashCalculateService.calculate('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b');
    expect(hashCalculateService.calculate('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')).toBe('d174ab98d277d9f5a5611c2c9f419d9f');
    expect(hashCalculateService.calculate('12345678901234567890123456789012345678901234567890123456789012345678901234567890')).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });

  it('HashCalculateService calculate unicode string', () => {
    expect(hashCalculateService.calculate('😊')).toBe('5deda34cd95f304948d2bc1b4a62c11e');
    expect(hashCalculateService.calculate('😊a😊')).toBe('c7f73db036e1509bc9eb0daa04881195');
  });

  it('HashCalculateService calculate Node.js buffers', () => {
    expect(hashCalculateService.calculate(Buffer.from([]))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(hashCalculateService.calculate(Buffer.from(['a'.charCodeAt(0)]))).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(hashCalculateService.calculate(Buffer.from([0]))).toBe('93b885adfe0da089cdf634904fd59f71');
    expect(hashCalculateService.calculate(Buffer.from([0, 1, 0, 0, 2, 0]))).toBe('8dd6f66d8ae62c8c777d9b62fe7ae1af');
  });

  it('HashCalculateService calculate typed arrays', () => {
    const arr = [0, 1, 2, 3, 4, 5, 255, 254];
    expect(hashCalculateService.calculate(Buffer.from(arr))).toBe('f29787c936b2acf6bca41764fc0376ec');
    const uint8 = new Uint8Array(arr);
    expect(hashCalculateService.calculate(uint8)).toBe('f29787c936b2acf6bca41764fc0376ec');
    expect(hashCalculateService.calculate(new Uint16Array(uint8.buffer))).toBe('f29787c936b2acf6bca41764fc0376ec');
    expect(hashCalculateService.calculate(new Uint32Array(uint8.buffer))).toBe('f29787c936b2acf6bca41764fc0376ec');
  });

  it('HashCalculateService calculate long buffers', () => {
    const SIZE = 5 * 1024 * 1024;
    const buf = Buffer.alloc(SIZE);
    buf.fill('\x00\x01\x02\x03\x04\x05\x06\x07\x08\xFF');
    expect(hashCalculateService.calculate(buf)).toBe('f195aef51a25af5d29ca871eb3780c06');
  });
});
