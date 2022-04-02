import { UtilsModule } from '../../src/node';

describe('template test', () => {
  it('UtilsModule', () => {
    const cls = new UtilsModule();
    expect(cls.providers).toEqual([]);
  });
});
