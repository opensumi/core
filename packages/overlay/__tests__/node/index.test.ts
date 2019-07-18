import { OverlayModule } from '../../src/node';

describe('template test', () => {
  it('OverlayModule', () => {
    const cls = new OverlayModule();
    expect(cls.providers).toEqual([]);
  });
});
