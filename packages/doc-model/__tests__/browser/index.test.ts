import { DocModelModule } from '../../src/browser';

describe('template test', () => {
  it('DocModelModule', () => {
    const cls = new DocModelModule();
    expect(cls.providers).toEqual([]);
  });
});
