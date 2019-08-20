import { ScmModule } from '../../src/node';

describe('template test', () => {
  it('ScmModule', () => {
    const cls = new ScmModule();
    expect(cls.providers).toEqual([]);
  });
});
