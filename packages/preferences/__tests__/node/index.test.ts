import { PreferencesModule } from '../../src/node';

describe('template test', () => {
  it('PreferencesModule', () => {
    const cls = new PreferencesModule();
    expect(cls.providers).toEqual([]);
  });
});
