import { DebugWatch, DebugThread } from '@ali/ide-debug/lib/browser';
import { ILogger } from '@ali/ide-core-browser';
import { DebugProtocol } from '@ali/vscode-debugprotocol/lib/debugProtocol';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockLogger } from '@ali/ide-core-browser/__mocks__/logger';
import { IDebugSessionManager } from '@ali/ide-debug';

describe('DebugWatch Model', () => {
  describe('DebugWatch should be work after init', () => {
    // init and mock api
    let injector: MockInjector;

    let debugWatch: DebugWatch;
    let debugManager;
    let session;
    const raw: DebugProtocol.Thread = {
      id: 0,
      name: 'thread',
    };

    beforeEach(() => {
      session = {
        id: 'session',
        evaluate: jest.fn(),
        onVariableChange: jest.fn(),
        onDidChangeCallStack: jest.fn(),
      } as any;
      const debugThread = new DebugThread(session);
      debugThread.update({raw});
      debugManager = {
        currentSession: session,
        currentThread: debugThread,
        onDidStopDebugSession: jest.fn(() => {
          return {
            dispose() {},
          };
        }),
        onDidDestroyDebugSession: jest.fn(() => {
          return {
            dispose() {},
          };
        }),
        onDidChangeActiveDebugSession: jest.fn((fn) => {
          fn();
          return {
            dispose() {},
          };
        }),
      };
      injector = createBrowserInjector([]);
      injector.addProviders({
        token: DebugWatch,
        useClass: DebugWatch,
      });
      injector.addProviders({
        token: ILogger,
        useClass: MockLogger,
      });
      injector.addProviders({
        token: IDebugSessionManager,
        useValue: debugManager,
      });
      injector.addProviders({
        token: DebugWatch,
        useClass: DebugWatch,
      });
      debugWatch = injector.get(DebugWatch);
    });

    afterEach(() => {
      session.evaluate.mockReset();
      debugManager.onDidStopDebugSession.mockReset();
      debugManager.onDidDestroyDebugSession.mockReset();
      debugManager.onDidChangeActiveDebugSession.mockReset();
    });

    it ('Should have enough values', async (done) => {
      await debugWatch.whenReady;
      expect(debugManager.onDidStopDebugSession).toBeCalledTimes(1);
      expect(debugManager.onDidDestroyDebugSession).toBeCalledTimes(1);
      expect(debugManager.onDidChangeActiveDebugSession).toBeCalledTimes(1);
      done();
    });

    it('addWatchExpression method should be work', async (done) => {
      await debugWatch.addWatchExpression('a');
      const root = await debugWatch.getRoot();
      expect(root.branchSize).toBe(0);
      expect(root.presetChildren.length).toBe(1);
      done();
    });

    it('updateWatchExpressions method should be work', async (done) => {
      await debugWatch.updateWatchExpressions(['a', 'b']);
      const root = await debugWatch.getRoot();
      expect(root.branchSize).toBe(0);
      expect(root.presetChildren.length).toBe(2);
      done();
    });

    it('renameWatchExpression method should be work', async (done) => {
      await debugWatch.updateWatchExpressions(['a', 'b']);
      await debugWatch.renameWatchExpression('a', 'a2');
      const root = await debugWatch.getRoot();
      expect(root.branchSize).toBe(0);
      expect(root.presetChildren.length).toBe(2);
      done();
    });

    it('removeWatchExpression method should be work', async (done) => {
      await debugWatch.updateWatchExpressions(['a', 'b']);
      await debugWatch.removeWatchExpression('b');
      const root = await debugWatch.getRoot();
      expect(root.branchSize).toBe(0);
      expect(root.presetChildren.length).toBe(1);
      done();
    });

    it('clear method should be work', async (done) => {
      await debugWatch.updateWatchExpressions(['a', 'b']);
      await debugWatch.clear();
      const root = await debugWatch.getRoot();
      expect(root.branchSize).toBe(0);
      expect(root.presetChildren.length).toBe(0);
      done();
    });

  });
});
