import { StartupModule } from '../../src/node';

describe('template test', () => {
  it('StartupModule', () => {
    const cls = new StartupModule();
    expect(cls.providers).toEqual([]);
  });
});
