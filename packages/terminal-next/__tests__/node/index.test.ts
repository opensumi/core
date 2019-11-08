import { TerminalNextModule } from '../../src/node';

describe('template test', () => {
  it('TerminalNextModule', () => {
    const cls = new TerminalNextModule();
    expect(cls.providers).toEqual([]);
  });
});
