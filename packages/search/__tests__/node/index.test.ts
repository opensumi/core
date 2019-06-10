import { SearchModule } from '../../src/node';

describe('template test', () => {
  it('SearchModule', () => {
    const cls = new SearchModule();
    expect(cls.providers).toEqual([]);
  });
});
