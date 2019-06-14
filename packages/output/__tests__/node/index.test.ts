import { OutputModule } from '../../src/node';

describe('template test', () => {
  it('OutputModule', () => {
    const cls = new OutputModule();
    expect(cls.providers).toEqual([]);
  });
});
