import { ActivityPanelModule } from '../../src/node';

describe('template test', () => {
  it('ActivityPanelModule', () => {
    const cls = new ActivityPanelModule();
    expect(cls.providers).toEqual([]);
  });
});
