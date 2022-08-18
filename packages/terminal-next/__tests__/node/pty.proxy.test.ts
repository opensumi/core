import os from 'os';

import { Injector } from '@opensumi/di';
import { normalizedIpcHandlerPath } from '@opensumi/ide-core-common/lib/utils/ipc';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { TerminalNodePtyModule } from '../../src/node';
import { PtyService } from '../../src/node/pty';
import { PtyServiceManagerToken } from '../../src/node/pty.manager';
import { PtyServiceManagerRemote } from '../../src/node/pty.manager.remote';
import { PtyServiceProxyRPCProvider } from '../../src/node/pty.proxy';

// 使用Remote模式（非Local模式）来测试PtyService
describe('PtyService function should be valid', () => {
  jest.setTimeout(20000);

  let injector: Injector;
  let shellPath = '';
  let proxyProvider: PtyServiceProxyRPCProvider;
  const ipcPath = normalizedIpcHandlerPath('NODE-TEST-PTY', true);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  if (os.platform() === 'win32') {
    shellPath = 'powershell';
  } else if (os.platform() === 'linux' || os.platform() === 'darwin') {
    shellPath = 'sh';
  }

  beforeAll(async () => {
    injector = createNodeInjector([TerminalNodePtyModule]);

    // 双容器模式下，需要以本文件作为entry单独打包出一个可执行文件，运行在DEV容器中
    proxyProvider = new PtyServiceProxyRPCProvider({ path: ipcPath });
    proxyProvider.initServer();
    injector.overrideProviders({
      token: PtyServiceManagerToken,
      useValue: injector.get(PtyServiceManagerRemote, [{ path: ipcPath }]),
    });
    await delay(2000);
  });

  afterAll(() => {
    // 强制关闭Socket Server 正常情况下会监听process的exit来关闭，但是在测试中，需要手动close
    proxyProvider['server']?.close();
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
});
