import http from 'http';

import WebSocket from 'ws';

import { WSWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { Deferred, Emitter, Uri } from '@opensumi/ide-core-common';

import { RPCService } from '../../src';
import { RPCServiceCenter, initRPCService } from '../../src/common';
import { RPCProtocol, createMainContextProxyIdentifier } from '../../src/common/ext-rpc-protocol';
import { WSChannel, parse } from '../../src/common/ws-channel';
import { WebSocketServerRoute, CommonChannelHandler, commonChannelPathHandler } from '../../src/node';

const wssPort = 7788;

class MockFileService extends RPCService {
  getContent(filePath) {
    return `file content ${filePath}`;
  }
  fileDirs(dirs: string[]) {
    return dirs.join(',');
  }
  throwError() {
    throw new Error('test error');
  }
}
const mockFileService = new MockFileService();

describe('connection', () => {
  it('websocket connection route', async () => {
    const server = http.createServer();
    const socketRoute = new WebSocketServerRoute(server, console);
    const channelHandler = new CommonChannelHandler('/service', console);
    socketRoute.registerHandler(channelHandler);
    socketRoute.init();

    await new Promise<void>((resolve) => {
      server.listen(wssPort, () => {
        resolve();
      });
    });

    const mockHandler = jest.fn();
    commonChannelPathHandler.register('TEST_CHANNEL', {
      handler: mockHandler,
      dispose: () => {},
    });

    const connection = new WebSocket(`ws://0.0.0.0:${wssPort}/service`);

    connection.on('error', () => {
      connection.close();
    });
    await new Promise<void>((resolve) => {
      connection.on('open', () => {
        resolve();
      });
    });
    const clientId = 'TEST_CLIENT';
    const wsConnection = new WSWebSocketConnection(connection);
    const channel = new WSChannel(wsConnection, {
      id: 'TEST_CHANNEL_ID',
      tag: 'test',
    });
    connection.on('message', (msg: Uint8Array) => {
      const msgObj = parse(msg);
      if (msgObj.kind === 'server-ready') {
        if (msgObj.id === 'TEST_CHANNEL_ID') {
          channel.handleMessage(msgObj);
        }
      }
    });

    await new Promise<void>((resolve) => {
      channel.onOpen(() => {
        resolve();
      });
      channel.open('TEST_CHANNEL', clientId);
    });
    expect(mockHandler.mock.calls.length).toBe(1);

    // do clean up
    connection.close();
    const deferred = new Deferred();
    socketRoute.deleteHandler(channelHandler);
    server.close(() => {
      deferred.resolve();
    });
    await deferred.promise;
  });

  it('get 401 error if websocket verification failed', async () => {
    const server = http.createServer();
    const deferred = new Deferred();
    const socketRoute = new WebSocketServerRoute(server, console);
    const channelHandler = new CommonChannelHandler('/service', console, {
      wsServerOptions: {
        verifyClient: () => false,
      },
    });
    socketRoute.registerHandler(channelHandler);
    socketRoute.init();

    await new Promise<void>((resolve) => {
      server.listen(wssPort, () => {
        resolve();
      });
    });

    const mockHandler = jest.fn();
    commonChannelPathHandler.register('TEST_CHANNEL', {
      handler: mockHandler,
      dispose: () => {},
    });

    const connection = new WebSocket(`ws://0.0.0.0:${wssPort}/service`);

    connection.on('error', (e) => {
      deferred.reject(e);
      connection.close();
    });
    await expect(deferred.promise).rejects.toThrow('Unexpected server response: 401');
    server.close();
  });

  it('RPCService', async () => {
    const wss = new WebSocket.Server({ port: wssPort });
    const notificationMock = jest.fn();

    let serviceCenter: RPCServiceCenter;
    let clientConnection: WebSocket;

    await Promise.all([
      new Promise<void>((resolve) => {
        wss.on('connection', (connection) => {
          serviceCenter = new RPCServiceCenter();
          const channel = WSChannel.forWebSocket(connection, {
            id: 'test-wss',
            tag: 'test-wss',
          });

          serviceCenter.setChannel(channel);

          resolve();
        });
      }),

      new Promise<void>((resolve) => {
        clientConnection = new WebSocket(`ws://0.0.0.0:${wssPort}/service`);
        clientConnection.on('open', () => {
          resolve();
        });
      }),
    ]);

    const { createRPCService } = initRPCService(serviceCenter!);
    createRPCService('MockFileServicePath', mockFileService);

    createRPCService('MockNotificationService', {
      onFileChange() {
        notificationMock();
      },
    });

    const clientCenter = new RPCServiceCenter();
    const channel = WSChannel.forWebSocket(clientConnection!, {
      id: 'test',
      tag: 'test',
    });

    const toDispose = clientCenter.setChannel(channel);
    clientConnection!.once('close', () => {
      toDispose.dispose();
    });
    const { getRPCService } = initRPCService<
      MockFileService & {
        onFileChange: (k: any) => void;
      }
    >(clientCenter);

    const remoteService = getRPCService('MockFileServicePath');
    const remoteResult = await remoteService.getContent('1');
    const remoteDirsResult = await remoteService.fileDirs(['/a.txt', '/b.txt']);

    try {
      await remoteService.throwError();
    } catch (e) {
      expect(e.message).toBe('test error');
    }

    expect(remoteResult).toBe('file content 1');
    expect(remoteDirsResult).toBe(['/a.txt', '/b.txt'].join(','));

    const remoteNotificationService = getRPCService('MockNotificationService');
    await remoteNotificationService.onFileChange(['add', '/a.txt']);
    await remoteNotificationService.onFileChange('deleteall');

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve(undefined);
      }, 1000);
    });

    expect(notificationMock.mock.calls.length).toBe(2);

    wss.close();
    clientConnection!.close();
  });

  it('RPCProtocol', async () => {
    const emitterA = new Emitter<string>();
    const emitterB = new Emitter<string>();

    const mockClientB = {
      onMessage: emitterB.event,
      send: (msg) => emitterA.fire(msg),
    };
    const mockClientA = {
      send: (msg) => emitterB.fire(msg),
      onMessage: emitterA.event,
    };

    const aProtocol = new RPCProtocol(mockClientA);
    const bProtocol = new RPCProtocol(mockClientB);

    const testMainIdentifier = createMainContextProxyIdentifier('testIendifier');
    const mockMainIndetifierMethod = jest.fn();
    const mockUriTestFn = jest.fn((uri) => uri);
    const mockErrorFn = jest.fn(() => {
      throw new Error('custom error');
    });

    aProtocol.set(testMainIdentifier, {
      $test: mockMainIndetifierMethod,
      $getUri: mockUriTestFn,
      $errorFunction: mockErrorFn,
    });

    function errorFunction() {
      return bProtocol.getProxy(testMainIdentifier).$errorFunction();
    }

    const testUri = Uri.file('/workspace/README.md');
    await bProtocol.getProxy(testMainIdentifier).$test();
    await bProtocol.getProxy(testMainIdentifier).$getUri(testUri);
    expect(mockMainIndetifierMethod.mock.calls.length).toBe(1);
    expect(mockUriTestFn.mock.results[0].value).toBeInstanceOf(Uri);
    expect(mockUriTestFn.mock.results[0].value.toString()).toBe(testUri.toString());
    await expect(errorFunction()).rejects.toThrow(new Error('custom error'));
  });

  it('RPCProtocol Timeout', async () => {
    const emitterTimeoutA = new Emitter<string>();
    const emitterTimeoutB = new Emitter<string>();
    const emitterTimeoutC = new Emitter<string>();

    const mockClientTA = {
      onMessage: emitterTimeoutA.event,
      send: (msg) => emitterTimeoutB.fire(msg),
    };
    const mockClientTB = {
      onMessage: emitterTimeoutB.event,
      send: (msg) => emitterTimeoutA.fire(msg),
    };
    const mockClientTC = {
      onMessage: emitterTimeoutC.event,
      send: (msg) => emitterTimeoutA.fire(msg),
      timeout: 1000,
    };

    const timeoutAProtocol = new RPCProtocol(mockClientTA);
    const timeoutBProtocol = new RPCProtocol(mockClientTB);
    const timeoutCProtocol = new RPCProtocol(mockClientTC);

    const testTimeoutIdentifier = createMainContextProxyIdentifier('testTimeoutIdentifier');
    timeoutAProtocol.set(testTimeoutIdentifier, {
      $test: jest.fn(),
    });

    await expect(timeoutBProtocol.getProxy(testTimeoutIdentifier).$test()).resolves.toBe(void 0);
    await expect(timeoutCProtocol.getProxy(testTimeoutIdentifier).$test()).rejects.toThrow(new Error('RPC Timeout: 1'));
  });
});
