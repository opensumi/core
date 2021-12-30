import { Injector } from '@opensumi/di';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { TerminalNodePtyModule } from '../../src/node';
import { IPtyService, PtyService } from '../../src/node/pty';
import os from 'os';

describe('PtyService function should be valid', () => {
  jest.setTimeout(10000);

  let ptyService: PtyService;
  let injector: Injector;
  let shellPath = '';

  if (os.platform() === 'win32') {
    shellPath = 'powershell';
  } else if (os.platform() === 'linux' || os.platform() === 'darwin') {
    shellPath = 'sh';
  }

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule], new Injector([]));
    ptyService = injector.get(IPtyService);
  });

  it('cannot create a invalid shell case1', async () => {
    await expect(ptyService.create2({ cols: 200, rows: 200, shellPath: '' })).rejects.toThrowError(
      'IShellLaunchConfig.shellPath not set',
    );
  });

  it('cannot create a invalid shell case2', async () => {
    await expect(
      ptyService.create2({ cols: 200, rows: 200, shellPath, cwd: '/this/path/not/exists' }),
    ).rejects.toThrowError();
  });

  it('can create a valid pty instance', async () => {
    const instance = await ptyService.create2({ cols: 200, rows: 200, shellPath });
    expect(instance).toBeDefined();
    expect(instance.pid).toBeDefined();
    expect(instance.launchConfig).toBeDefined();
  });

  it('cwd is user home dir if not set', async () => {
    const instance = await ptyService.create2({ cols: 200, rows: 200, shellPath, args: ['-c', 'pwd'] });
    let result = '';

    if (os.platform() !== 'win32') {
      await new Promise<void>((resolve) => {
        instance.onData((data) => {
          result += data;
          resolve(undefined);
        });
      });
      expect(result).toContain(os.homedir());
    }
  });
});
