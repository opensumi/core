import { ThemeModule } from '../../src/node';

describe('template test', () => {
  it('ThemeModule', () => {
    const cls = new ThemeModule();
    expect(cls.providers).toEqual([]);
  });
});
