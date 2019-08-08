import { ActivityBarModule } from '../../src/node';

describe('template test', () => {
  it('ActivityBarModule', () => {
    const cls = new ActivityBarModule();
    expect(cls.providers).toEqual([]);
  });
});
