import { GitModule } from '../../src/node';

describe('template test', () => {
  it('GitModule', () => {
    const cls = new GitModule();
    expect(cls.providers).toEqual([]);
  });
});
