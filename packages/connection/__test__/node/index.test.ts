import http from 'http';

import WebSocket from 'ws';

import { furySerializer, wrapSerializer } from '@opensumi/ide-connection/lib/common/serializer';
import { WSWebSocketConnection } from '@opensumi/ide-connection/src/common/connection';
import { SumiConnection } from '@opensumi/ide-connection/src/common/rpc/connection';
import { Deferred } from '@opensumi/ide-core-common';

import { RPCService } from '../../src';
import { RPCServiceCenter, initRPCService } from '../../src/common';
import { CommonChannelPathHandler } from '../../src/common/server-handler';
import { WSChannel } from '../../src/common/ws-channel';
import { CommonChannelHandler, WebSocketServerRoute } from '../../src/node';

const commonChannelPathHandler = new CommonChannelPathHandler();

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
    const channelHandler = new CommonChannelHandler('/service', commonChannelPathHandler, console);
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
    const channel = new WSChannel(wrapSerializer(wsConnection, furySerializer), {
      id: 'TEST_CHANNEL_ID',
    });
    connection.on('message', (msg: Uint8Array) => {
      const msgObj = furySerializer.deserialize(msg);
      if (msgObj.kind === 'server-ready') {
        if (msgObj.id === 'TEST_CHANNEL_ID') {
          channel.dispatch(msgObj);
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
    const channelHandler = new CommonChannelHandler('/service', commonChannelPathHandler, console, {
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
          const sumiConnection = SumiConnection.forWSWebSocket(connection, {});
          serviceCenter.setSumiConnection(sumiConnection);
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

    const connection = SumiConnection.forWSWebSocket(clientConnection!);
    const toDispose = clientCenter.setSumiConnection(connection);
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
});
