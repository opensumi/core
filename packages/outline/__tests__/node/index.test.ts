import { OutlineModule } from '../../src/node';

describe('template test', () => {
  it('OutlineModule', () => {
    const cls = new OutlineModule();
    expect(cls.providers).toEqual([]);
  });
});
