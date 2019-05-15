import { FileServiceModule } from '../../src/node';

describe('template test', () => {
  it('FileServiceModule', () => {
    const cls = new FileServiceModule();
    expect(cls.providers).toEqual([]);
  });
});
