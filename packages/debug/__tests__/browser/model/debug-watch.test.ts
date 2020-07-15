import { DebugWatch, DebugThread } from '@ali/ide-debug/lib/browser';
import { ILogger } from '@ali/ide-core-browser';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/mocks/logger';
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
        useClass: MockLoggerManageClient,
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

    it('execute method should be work', async (done) => {
      await debugWatch.execute('test');
      expect(session.evaluate).toBeCalledTimes(1);
      done();
    });

    it('getChildren method should be work', async (done) => {
      await debugWatch.execute('test');
      expect(session.evaluate).toBeCalledTimes(1);
      const children = await debugWatch.getChildren();
      expect(children.length === 1).toBe(true);
      expect(session.evaluate).toBeCalledTimes(2);
      done();
    });

  });
});
