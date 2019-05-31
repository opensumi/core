import { ActivatorPanelModule } from '../../src/node';

describe('template test', () => {
  it('ActivatorPanelModule', () => {
    const cls = new ActivatorPanelModule();
    expect(cls.providers).toEqual([]);
  });
});
