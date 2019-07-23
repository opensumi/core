import { ExtensionStorageModule } from '../../src/node';

describe('template test', () => {
  it('ExtensionStorageModule', () => {
    const cls = new ExtensionStorageModule();
    expect(cls.providers).toEqual([]);
  });
});
