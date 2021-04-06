import { IDebugSessionManager } from '@ali/ide-debug';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { DebugSessionConnection } from '@ali/ide-debug/lib/browser';
import { Emitter } from '@ali/ide-core-browser';

describe('DebugSessionConnection', () => {
  let debugSessionConnection: DebugSessionConnection;
  let injector: MockInjector;

  const mockDebugSessionManager = {
    reportTime: jest.fn(() => jest.fn()),
  };

  const messageEmitter: Emitter<string> = new Emitter();

  const mockConnection = {
    onClose: jest.fn(),
    onMessage: messageEmitter.event,
    send: jest.fn((request) => {
      const requestData = JSON.parse(request);
      // 立即返回值
      messageEmitter.fire(JSON.stringify({
        type: 'response',
        request_seq: requestData.seq,
        body: {
          hello: 'world',
        },
        success: true,
      }));
    }),
  };

  const connectionFactory = (sessionId: string) => mockConnection as any;

  const traceOutputChannel =  {
    appendLine: jest.fn(),
  } as any;

  beforeAll(() => {
    injector = createBrowserInjector([], new MockInjector([
      {
        token: IDebugSessionManager,
        useValue: mockDebugSessionManager,
      },
    ]));
    debugSessionConnection = injector.get(DebugSessionConnection, ['1001', connectionFactory, traceOutputChannel]);
  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('first, create connection', () => {
    expect(mockConnection.onClose).toBeCalledTimes(1);
  });

  it('send initialize command', async () => {
    await debugSessionConnection.sendRequest('initialize', { clientID: 'kaitian', adapterID: 'node'}, {
      type: 'node',
      name: 'test',
      request: 'node-debug',
    });
    expect(mockConnection.send).toBeCalledTimes(1);
    mockConnection.send.mockClear();
  });

  it('send continue command', async (done) => {
    debugSessionConnection.on('continued', (event) => {
      expect(event.event).toBe('continued');
      done();
    });
    await debugSessionConnection.sendRequest('continue', { threadId: 1000001 }, {
      type: 'node',
      name: 'test',
      request: 'node-debug',
    });
    expect(mockConnection.send).toBeCalledTimes(1);
    mockConnection.send.mockClear();
  });

  it('send custom request', async () => {
    await debugSessionConnection.sendCustomRequest('abc', {});
    expect(mockConnection.send).toBeCalledTimes(1);
  });

  it('handle request message', async (done) => {
    debugSessionConnection.onRequest('abc', () => {
      done();
    });
    await messageEmitter.fire(JSON.stringify({
      type: 'request',
      command: 'abc',
      seq: '1000002',
    }));
  });

  it('handle response message', async () => {
    const requestPromise = debugSessionConnection.sendCustomRequest('bcd', {
      seq: '999',
    });
    messageEmitter.fire(JSON.stringify({
      type: 'response',
      request_seq: '999',
      body: {
        hello: 'world',
      },
    }));
    expect((await requestPromise).body).toBeDefined();
  });

  it('handle event message', (done) => {
    debugSessionConnection.on('exited', () => {
      done();
    });
    messageEmitter.fire(JSON.stringify({
      type: 'event',
    }));
  });
});
