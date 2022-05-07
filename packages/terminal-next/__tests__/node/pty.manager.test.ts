import { Injector } from '@opensumi/di';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';

import { TerminalNodePtyModule } from '../../src/node';
import { PtyServiceManagerToken, IPtyServiceManager, PtyServiceManager } from '../../src/node/pty.manager';
import { PtyServiceProxyRPCProvider } from '../../src/node/pty.proxy';

const delay = (t: number) => new Promise((resolve) => setTimeout(resolve, t));

describe('Pty Manager Test Local', () => {
  let injector: Injector;
  let ptyServiceManager: IPtyServiceManager;

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule]);
  });

  it('pty manager create and kill', async () => {
    ptyServiceManager = injector.get(PtyServiceManager);
    const ptyService = await ptyServiceManager.spawn('bash', [], {}, 'fake-session-1');
    expect(ptyService.onData).toBeDefined();
    expect(ptyService).toBeDefined();
    expect(ptyService?.pid).toBeDefined();
    const process = await ptyService.getProcessDynamically();
    expect(process).toEqual('bash');
    ptyService.write('pwd\n');

    ptyService.kill();

    const sessionAlive = await ptyServiceManager.checkSession('fake-session-1');
    expect(sessionAlive).toBeFalsy();
  });
});

describe('Pty Manager Test Local', () => {
  let injector: Injector;
  let ptyServiceManager: IPtyServiceManager;

  beforeEach(() => {
    injector = createNodeInjector([TerminalNodePtyModule]);
  });

  // 远程模式使用PtyService
  it('pty manager create and remote', async () => {
    // 双容器模式下，需要以本文件作为entry单独打包出一个可执行文件，运行在DEV容器中
    const proxyProvider = new PtyServiceProxyRPCProvider();
    proxyProvider.initServer();
    await delay(1000);

    injector.addProviders({
      token: PtyServiceManagerToken,
      useValue: new PtyServiceManager(),
    });

    ptyServiceManager = injector.get(PtyServiceManagerToken);
    const ptyService = await ptyServiceManager.spawn('sh', [], {}, 'fake-session-1');
    expect(ptyService.onData).toBeDefined();
    expect(ptyService).toBeDefined();
    expect(ptyService?.pid).toBeDefined();
    const process = await ptyService.getProcessDynamically();
    expect(process).toEqual('sh');
    ptyService.write('pwd\n');

    ptyService.kill();

    const sessionAlive = await ptyServiceManager.checkSession('fake-session-1');
    expect(sessionAlive).toBeFalsy();

    // close test server
    proxyProvider['server']?.close();
  });
});
