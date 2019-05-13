import { BrowserCls } from '../../src/browser';

describe('template test', () => {
  it(' 1 + 2 = 3', () => {
    const cls = new BrowserCls();
    expect(cls.add(1, 2)).toBe(3);
  });
});
