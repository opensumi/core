import { PtyService, IPty } from '../../src/node/pty';

describe('PtyService', () => {
  const ptyService = new PtyService();

  test('create', () => {
    const pty: IPty = ptyService.create(2, 4, {
      name: 'shell_1',
    });

    expect(typeof pty.pid === 'number').toBe(true);
    expect(typeof pty.process === 'string').toBe(true);
    pty.kill();
  });

  test('resize', () => {
    const pty: IPty = ptyService.create(2, 4, {
      name: 'shell_1',
    });

    expect(ptyService.resize(pty, 4, 5)).toBe(true);
    pty.kill();
  });
});
