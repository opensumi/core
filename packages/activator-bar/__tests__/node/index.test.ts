import { ActivatorBarModule } from '../../src/node';

describe('template test', () => {
  it('ActivatorBarModule', () => {
    const cls = new ActivatorBarModule();
    expect(cls.providers).toEqual([]);
  });
});
