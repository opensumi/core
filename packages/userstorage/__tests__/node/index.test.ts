import { UserstorageModule } from '../../src/node';

describe('template test', () => {
  it('UserstorageModule', () => {
    const cls = new UserstorageModule();
    expect(cls.providers).toEqual([]);
  });
});
