import { StatusBarModule } from '../../src/node';

describe('template test', () => {
  it('StatusBarModule', () => {
    const cls = new StatusBarModule();
    expect(cls.providers).toEqual([]);
  });
});
