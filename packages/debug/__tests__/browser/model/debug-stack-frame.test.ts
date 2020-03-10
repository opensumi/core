import { DebugThread, DebugStackFrame } from '@ali/ide-debug/lib/browser';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';

describe('DebugStackFrame Model', () => {
  describe('DebugStackFrame should be work after init', () => {
    // init and mock api
    let session;

    let debugThread: DebugThread;
    let debugStackFrame: DebugStackFrame;

    const raw: DebugProtocol.StackFrame = {
      id: 0,
      name: 'frame',
      line: 1,
      column: 1,
    };
    const rawThread: DebugProtocol.Thread = {
      id: 0,
      name: 'thread',
    };
    beforeEach(() => {
      session = {
        id: 'session',
        sendRequest: jest.fn((type) => {
          if (type === 'scopes') {
            return {
              body: {
                scopes: [],
              },
            };
          }
          return {
            body: {
              content: '',
            },
          };
        }),
      } as any;
      debugThread = new DebugThread(session);
      debugThread.update({raw: rawThread});
      debugStackFrame = new DebugStackFrame(debugThread, session);
      debugStackFrame.update({raw});
    });

    afterEach(() => {
      session.sendRequest.mockReset();
    });

    it ('Should have enough values', () => {
      expect(typeof debugStackFrame.source).toBe('undefined');
    });

    it ('restart method should be work', async (done) => {
      await debugStackFrame.restart();
      expect(session.sendRequest).toBeCalledWith('restartFrame', {
        threadId: `${session.id}:${rawThread.id}`,
        frameId: raw.id,
      });
      done();
    });

    it ('getScopes method should be work', async (done) => {
      await debugStackFrame.getScopes();
      expect(session.sendRequest).toBeCalledWith('scopes', {
        frameId: raw.id,
      });
      done();
    });

  });
});
