import { DocModelModule } from '../../src/node';

describe('template test', () => {
  it('DocModelModule', () => {
    const cls = new DocModelModule();
    expect(cls.providers).toEqual([]);
  });
});
