import os from 'os';

import { Injector } from '@opensumi/di';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { TerminalNodePtyModule } from '../../src/node';
import { PtyService } from '../../src/node/pty';

describe('PtyService function should be valid', () => {
  jest.setTimeout(10000);

  let injector: Injector;
  let shellPath = '';

  if (os.platform() === 'win32') {
    shellPath = 'powershell';
  } else if (os.platform() === 'linux' || os.platform() === 'darwin') {
    shellPath = 'sh';
  }

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule], new Injector([]));
  });

  it('cannot create a invalid shell case1', async () => {
    const ptyService = injector.get(PtyService, ['0', { executable: '' }, 200, 200]);
    const error = await ptyService.start();
    expect(error?.message).toEqual('IShellLaunchConfig.executable not set');
  });

  it('cannot create a invalid shell case2', async () => {
    const ptyService = injector.get(PtyService, [
      '0',
      { executable: shellPath, cwd: '/this/path/not/exists' },
      200,
      200,
    ]);
    const error = await ptyService.start();
    expect(error).toBeTruthy();
  });

  it('can create a valid pty instance', async () => {
    const ptyService = injector.get(PtyService, ['0', { executable: shellPath }, 200, 200]);
    const error = await ptyService.start();
    const instance = ptyService.pty;
    expect(error).toBeUndefined();
    expect(instance).toBeDefined();
    expect(instance?.pid).toBeDefined();
    expect(instance?.launchConfig).toBeDefined();
  });

  it('cwd is user home dir if not set', async () => {
    const ptyService = injector.get(PtyService, ['0', { executable: shellPath, args: ['-c', 'pwd'] }, 200, 200]);
    const error = await ptyService.start();
    const instance = ptyService.pty;

    expect(error).toBeUndefined();

    let result = '';

    if (os.platform() !== 'win32') {
      await new Promise<void>((resolve) => {
        instance?.onData((data) => {
          result += data;
          resolve(undefined);
        });
      });
      expect(result).toContain(os.homedir());
    }
  });
});
