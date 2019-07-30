import { StorageModule } from '../../src/node';

describe('template test', () => {
  it('StorageModule', () => {
    const cls = new StorageModule();
    expect(cls.providers).toEqual([]);
  });
});
