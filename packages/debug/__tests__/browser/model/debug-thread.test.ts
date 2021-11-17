import { DebugThread, DebugStackFrame } from '@ide-framework/ide-debug/lib/browser';
import { DebugProtocol } from '@ide-framework/vscode-debugprotocol/lib/debugProtocol';

describe('DebugThread Model', () => {
  describe('DebugThread should be work after init', () => {
    // init and mock api
    let session;

    let debugThread: DebugThread;
    let debugStackFrame: DebugStackFrame;
    const raw: DebugProtocol.Thread = {
      id: 0,
      name: 'thread',
    };
    const rawFrame: DebugProtocol.StackFrame = {
      id: 0,
      name: 'frame',
      line: 1,
      column: 1,
    };

    beforeEach(() => {

      session = {
        id: 'session',
        sendRequest: jest.fn((type) => {
          if (type === 'stackTrace') {
            return {
              body: {
                stackFrames: [],
                totalFrames: undefined,
              },
            };
          }
        }),
        capabilities: {
          supportsTerminateThreadsRequest: true,
        },
      } as any;
      debugThread = new DebugThread(session);
      debugThread.update({raw});
      debugStackFrame = new DebugStackFrame(debugThread, session);
      debugStackFrame.update({
        raw: rawFrame,
      });
    });

    afterEach(() => {
      session.sendRequest.mockReset();
    });

    it ('Should have enough values', () => {
      expect(debugThread.id).toBe(`${session.id}:${raw.id}`);
      expect(typeof debugThread.currentFrame).toBe('undefined');
      expect(typeof debugThread.stopped).toBe('boolean');
      expect(typeof debugThread.topFrame).toBe('undefined');
      expect(Array.isArray(debugThread.frames)).toBe(true);
    });

    it ('Should have enough values', () => {
      expect(debugThread.id).toBe(`${session.id}:${raw.id}`);
      expect(typeof debugThread.currentFrame).toBe('undefined');
      expect(typeof debugThread.stopped).toBe('boolean');
    });

    it ('clear method should be work', () => {
      debugThread.clear();
      expect(typeof debugThread.currentFrame).toBe('undefined');
    });

    it ('terminate method should be work', async (done) => {
      debugThread.terminate();
      expect(session.sendRequest).toBeCalledWith('terminateThreads', {
        threadIds: [raw.id],
      });
      done();
    });

    it ('fetchFrames method should be work', async (done) => {
      await debugThread.fetchFrames();
      expect(session.sendRequest).toBeCalledWith('stackTrace', {
        threadId: raw.id,
        startFrame: 0,
        levels: 20,
      });
      done();
    });

    it ('continue method should be work', async (done) => {
      debugThread.continue();
      expect(session.sendRequest).toBeCalledWith('continue', {
        threadId: raw.id,
      });
      done();
    });

    it ('stepOver method should be work', async (done) => {
      debugThread.stepOver();
      expect(session.sendRequest).toBeCalledWith('next', {
        threadId: raw.id,
      });
      done();
    });

    it ('stepIn method should be work', async (done) => {
      debugThread.stepIn();
      expect(session.sendRequest).toBeCalledWith('stepIn', {
        threadId: raw.id,
      });
      done();
    });

    it ('stepOut method should be work', async (done) => {
      debugThread.stepOut();
      expect(session.sendRequest).toBeCalledWith('stepOut', {
        threadId: raw.id,
      });
      done();
    });

    it ('pause method should be work', async (done) => {
      debugThread.pause();
      expect(session.sendRequest).toBeCalledWith('pause', {
        threadId: raw.id,
      });
      done();
    });

  });
});
