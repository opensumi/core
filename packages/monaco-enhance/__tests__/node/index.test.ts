import { MonacoEnhanceModule } from '../../src/node';

describe('template test', () => {
  it('MonacoEnhanceModule', () => {
    const cls = new MonacoEnhanceModule();
    expect(cls.providers).toEqual([]);
  });
});
