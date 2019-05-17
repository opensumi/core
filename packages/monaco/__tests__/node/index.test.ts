import { MonacoModule } from '../../src/node';

describe('template test', () => {
  it('MonacoModule', () => {
    const cls = new MonacoModule();
    expect(cls.providers).toEqual([]);
  });
});
