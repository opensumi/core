import { NodeCls } from '../../src/node';

describe('template test', () => {
  it(' 1 + 2 = 3', () => {
    const cls = new NodeCls();
    expect(cls.add(1, 2)).toBe(3);
  });
});
