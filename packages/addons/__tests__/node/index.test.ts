import { AddonsModule } from '../../src/node';

describe('template test', () => {
  it('AddonsModule', () => {
    const cls = new AddonsModule();
    expect(cls.providers).toEqual([]);
  });
});
