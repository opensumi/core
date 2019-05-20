import { SidePanelModule } from '../../src/browser';

describe('template test', () => {
  it('SidePanelModule', () => {
    const cls = new SidePanelModule();
    expect(cls.providers).toEqual([]);
  });
});
