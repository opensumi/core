import { FileServiceModule } from '../../src/browser';

describe('template test', () => {
  it('FileServiceModule', () => {
    const cls = new FileServiceModule();
    expect(cls.providers).toEqual([]);
  });
});
