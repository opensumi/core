import { MarkersModule } from '../../src/node';

describe('template test', () => {
  it('MarkersModule', () => {
    const cls = new MarkersModule();
    expect(cls.providers).toEqual([]);
  });
});
