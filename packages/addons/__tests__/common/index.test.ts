import { CommonCls } from '../../src/common';

describe('template test', () => {
  it(' 1 + 2 = 3', () => {
    const cls = new CommonCls();
    expect(cls.add(1, 2)).toBe(3);
  });
});
