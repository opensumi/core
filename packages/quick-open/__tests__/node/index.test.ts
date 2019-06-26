import { QuickOpenModule } from '../../src/node';

describe('template test', () => {
  it('QuickOpenModule', () => {
    const cls = new QuickOpenModule();
    expect(cls.providers).toEqual([]);
  });
});
