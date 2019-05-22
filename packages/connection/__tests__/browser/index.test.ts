import { ConnectionModule } from '../../src/browser';

describe('template test', () => {
  it('ConnectionModule', () => {
    const cls = new ConnectionModule();
    expect(cls.providers).toEqual([]);
  });
});
