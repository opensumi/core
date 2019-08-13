import { LogsModule } from '../../src/node';

describe('template test', () => {
  it('LogsModule', () => {
    const cls = new LogsModule();
    expect(cls.providers).toEqual([]);
  });
});
