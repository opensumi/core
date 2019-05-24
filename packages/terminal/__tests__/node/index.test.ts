import { TerminalModule } from '../../src/node';

describe('template test', () => {
  it('TerminalModule', () => {
    const cls = new TerminalModule();
    expect(cls.providers).toEqual([]);
  });
});
