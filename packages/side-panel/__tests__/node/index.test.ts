import { SidePanelModule } from '../../src/node';

describe('template test', () => {
  it('SidePanelModule', () => {
    const cls = new SidePanelModule();
    expect(cls.providers).toEqual([]);
  });
});
