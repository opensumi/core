import path from 'path';

import { INodeLogger, Event, getDebugLogger, Disposable } from '@opensumi/ide-core-node';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExtHostProxy, IExtensionHostManager } from '../../src/common';
import { ExtHostProxy } from '../../src/hosted/ext.host.proxy-base';
import { ExtensionHostProxyManager } from '../../src/node/extension.host.proxy.manager';

import { MockEnvironmentVariableService } from './__mocks__/environmentVariableService';

// re-install RAL in `@opensumi/vscode-jsonrpc`
import '@opensumi/vscode-jsonrpc/lib/node/main';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROXY_PORT = 10296;
describe('ext host proxy test', () => {
  jest.setTimeout(10 * 1000);
  describe('extension host proxy', () => {
    const extHostPath = path.join(__dirname, '../../__mocks__/ext.host.js');
    let injector: MockInjector;
    let extHostProxy: IExtHostProxy;
    let extensionHostManager: IExtensionHostManager;
    beforeEach(async () => {
      injector = createNodeInjector([]);
      injector.addProviders(
        {
          token: INodeLogger,
          useValue: getDebugLogger(),
        },
        {
          token: EnvironmentVariableServiceToken,
          useValue: MockEnvironmentVariableService,
        },
        {
          token: IExtensionHostManager,
          useFactory(injector) {
            return injector.get(ExtensionHostProxyManager, [
              {
                port: PROXY_PORT,
              },
            ]);
          },
        },
      );
      extHostProxy = new ExtHostProxy({
        socketConnectOpts: {
          port: PROXY_PORT,
        },
      });
      extHostProxy.init();
      extensionHostManager = injector.get<IExtensionHostManager>(IExtensionHostManager);
      await Promise.all([
        extensionHostManager.init(),
        new Promise((resolve) => Event.once(extHostProxy.onConnected)(resolve)),
      ]);
      // ?????? connect ????????????
      await sleep(2000);
    });

    afterEach(async () => {
      await extensionHostManager.dispose();
      extHostProxy.dispose();
    });

    afterAll(async () => {
      await injector.disposeAll();
      await extHostProxy.dispose();
      await extensionHostManager.dispose();
    });

    it('retry connect if server close', async () => {
      // ???????????????
      await extensionHostManager.dispose();
      // ?????? 3s ???????????????????????????????????????
      await sleep(3000);
      // ???????????? IDE ??????
      // ????????????????????????????????????????????? di ??????
      extensionHostManager = injector.get(ExtensionHostProxyManager, [
        {
          port: PROXY_PORT,
        },
      ]);
      await extensionHostManager.init();
      // ??????????????????
      await sleep(2000);
      // // ?????????????????? fork ????????????
      const pid = await extensionHostManager.fork(extHostPath);
      expect(typeof pid).toBe('number');
      expect(await extensionHostManager.isRunning(pid)).toBeTruthy();
    }, 10000);
  });
});
