import { MonacoModule } from '../../src/browser';

describe('template test', () => {
  it('MonacoModule', () => {
    const cls = new MonacoModule();
    expect(cls.providers).toEqual([]);
  });
});
