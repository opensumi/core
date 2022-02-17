import { DebugThread, DebugStackFrame } from '@opensumi/ide-debug/lib/browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

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
      source: {},
    };
    const rawThread: DebugProtocol.Thread = {
      id: 0,
      name: 'thread',
    };
    let openSource;
    beforeEach(() => {
      openSource = jest.fn();
      session = {
        id: 'session',
        sendRequest: jest.fn((type, args) => {
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
        getSource: jest.fn(() => ({
          open: openSource,
        })),
        capabilities: {
          supportsRestartFrame: true,
        },
      } as any;
      debugThread = new DebugThread(session);
      debugThread.update({ raw: rawThread });
      debugStackFrame = new DebugStackFrame(debugThread, session);
      debugStackFrame.update({ raw });
    });

    afterEach(() => {
      openSource.mockReset();
      session.sendRequest.mockReset();
    });

    it('Should have enough values', () => {
      expect(typeof debugStackFrame.source).toBe('object');
    });

    it('restart method should be work', async () => {
      await debugStackFrame.restart();
      expect(debugStackFrame.session.sendRequest).toBeCalledWith('restartFrame', {
        frameId: raw.id,
      });
    });

    it('getScopes method should be work', async () => {
      await debugStackFrame.getScopes();
      expect(session.sendRequest).toBeCalledWith('scopes', {
        frameId: raw.id,
      });
    });

    it('open method should be work', async () => {
      await debugStackFrame.open({});
      expect(openSource).toBeCalledTimes(1);
    });
  });
});
