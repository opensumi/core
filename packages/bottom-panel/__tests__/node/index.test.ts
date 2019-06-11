import { BottomPanelModule } from '../../src/node';

describe('template test', () => {
  it('BottomPanelModule', () => {
    const cls = new BottomPanelModule();
    expect(cls.providers).toEqual([]);
  });
});
