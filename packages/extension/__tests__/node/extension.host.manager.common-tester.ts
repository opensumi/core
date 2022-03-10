import path from 'path';

import { Provider } from '@opensumi/di';
import { INodeLogger, MaybePromise, getDebugLogger } from '@opensumi/ide-core-node';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExtensionHostManager } from '../../src';


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface IExtensionHostManagerTesterOptions {
  providers: Provider[];
  // 在 beforeEach 头部执行
  init: () => MaybePromise<void>;
  // 在 afterEach 头部执行
  dispose: () => MaybePromise<void>;
}

export const extensionHostManagerTester = (options: IExtensionHostManagerTesterOptions) =>
  describe(__filename, () => {
    let extensionHostManager: IExtensionHostManager;
    let injector: MockInjector;
    const extHostPath = path.join(__dirname, '../../__mocks__/ext.host.js');

    beforeEach(async () => {
      injector = createNodeInjector([]);
      injector.addProviders(
        {
          token: INodeLogger,
          useValue: getDebugLogger(),
        },
        ...options.providers,
      );
      extensionHostManager = injector.get<IExtensionHostManager>(IExtensionHostManager);
      // 等待服务端和客户端初始化完成
      await Promise.all([options.init(), extensionHostManager.init()]);
      // 等待 connect 连接成功
      await sleep(2000);
    });

    afterEach(async () => {
      await extensionHostManager.dispose();
      await options.dispose();
      injector.disposeAll();
    });

    it('fork extension host', async () => {
      const pid = await extensionHostManager.fork(extHostPath);
      expect(typeof pid).toBe('number');
      expect(await extensionHostManager.isRunning(pid)).toBeTruthy();
    });

    it('send message', async (done) => {
      const pid = await extensionHostManager.fork(extHostPath);
      // 等待 ready 发完
      await sleep(2000);
      extensionHostManager.onMessage(pid, (message) => {
        expect(message).toBe('finish');
        done();
      });
      await extensionHostManager.send(pid, 'close');
    });

    it('on message', async (done) => {
      const pid = await extensionHostManager.fork(extHostPath);
      extensionHostManager.onMessage(pid, (message) => {
        expect(message).toBe('ready');
        done();
      });
    });

    it('send kill signal', async (done) => {
      const pid = await extensionHostManager.fork(extHostPath);
      extensionHostManager.onExit(pid, async (code, signal) => {
        expect(signal).toBe('SIGTERM');
        expect(await extensionHostManager.isKilled(pid)).toBeTruthy();
        done();
      });
      await extensionHostManager.kill(pid);
    });

    it('tree kill', async (done) => {
      const pid = await extensionHostManager.fork(extHostPath);
      extensionHostManager.onExit(pid, async (code, signal) => {
        expect(signal).toBe('SIGTERM');
        // tree-kill 使用 process.kill 不能使用 killed 判断
        expect(await extensionHostManager.isRunning(pid)).toBeFalsy();
        done();
      });
      await extensionHostManager.treeKill(pid);
    });

    it('findDebugPort', async () => {
      const debugPort = await extensionHostManager.findDebugPort(3000, 500, 5000);
      expect(typeof debugPort).toBe('number');
      expect(Math.abs(debugPort - 3000)).toBeLessThan(500);
    });

    it('on output', async (done) => {
      const pid = await extensionHostManager.fork(extHostPath, [], { silent: true });
      extensionHostManager.onOutput(pid, (output) => {
        expect(output.data).toContain('send ready');
        done();
      });
    });

    it('dispose process', async () => {
      const pid = await extensionHostManager.fork(extHostPath);
      expect(typeof pid).toBe('number');
      expect(await extensionHostManager.isRunning(pid)).toBeTruthy();
      await extensionHostManager.disposeProcess(pid);
      // 等进程被 kill
      await sleep(2000);
      expect(await extensionHostManager.isRunning(pid)).toBeFalsy();
    });
  });
