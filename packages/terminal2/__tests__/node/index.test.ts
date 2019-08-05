import { Terminal2Module } from '../../src/node';

describe('template test', () => {
  it('Terminal2Module', () => {
    const cls = new Terminal2Module();
    expect(cls.providers).toEqual([]);
  });
});
