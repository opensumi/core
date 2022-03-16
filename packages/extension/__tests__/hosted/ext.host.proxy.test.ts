import path from 'path';

import { INodeLogger, Event, getDebugLogger } from '@opensumi/ide-core-node';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExtHostProxy, IExtensionHostManager } from '../../src/common';
import { ExtHostProxy } from '../../src/hosted/ext.host.proxy-base';
import { ExtensionHostProxyManager } from '../../src/node/extension.host.proxy.manager';

// re-install RAL in `@opensumi/vscode-jsonrpc`
import '@opensumi/vscode-jsonrpc/lib/node/main';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PROXY_PORT = 10296;
describe(__filename, () => {
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
      // 等待 connect 连接成功
      await sleep(2000);
    });

    afterEach(async () => {
      await extensionHostManager.dispose();
      extHostProxy.dispose();
    });

    afterAll(() => {
      injector.disposeAll();
      extHostProxy.dispose();
      extensionHostManager.dispose();
    });

    it('retry connect if server close', async () => {
      // 断开服务器
      await extensionHostManager.dispose();
      // 等待 3s 让插件进程管理进程持续重试
      await sleep(3000);
      // 重新启动 IDE 后端
      // 传入构造函数参数，以便重新生成 di 实例
      extensionHostManager = injector.get(ExtensionHostProxyManager, [
        {
          port: PROXY_PORT,
        },
      ]);
      await extensionHostManager.init();
      // 等待连接成功
      await sleep(2000);
      // // 还是可以正常 fork 插件进程
      const pid = await extensionHostManager.fork(extHostPath);
      expect(typeof pid).toBe('number');
      expect(await extensionHostManager.isRunning(pid)).toBeTruthy();
    }, 10000);
  });
});
