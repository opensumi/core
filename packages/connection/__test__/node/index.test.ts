import {
  RPCServiceCenter,
  initRPCService,
  createWebSocketConnection,
  createSocketConnection,
  RPCMessageConnection,
  WebSocketServerRoute,
  CommonChannelHandler,
  commonChannelPathHandler,
} from '../../src/node';
import {
  RPCService,
} from '../../src';
import {
  WSChannel,
} from '../../src/common/ws-channel';

import * as ws from 'ws';
import * as http from 'http';
const WebSocket = ws;

class MockFileService extends RPCService {
  getContent(filePath) {
    return `file content ${filePath}`;
  }
}

const mockFileService = new MockFileService();
describe('connection', () => {
  it('websocket connection route', async (done) => {
    const server = http.createServer();
    const socketRoute = new WebSocketServerRoute(server, console);
    const channelHandler = new CommonChannelHandler('/service', console);
    socketRoute.registerHandler(channelHandler);
    socketRoute.init();

    await new Promise((resolve) => {
      server.listen(7788, () => {
        console.log('server listen on 7788');
        resolve();
      });
    });

    const mockHandler = jest.fn();
    commonChannelPathHandler.register('TEST_CHANNEL', {
      handler: mockHandler,
      dispose: () => {},
    });

    const connection = new WebSocket('ws://127.0.0.1:7788/service');

    await new Promise((resolve) => {
      connection.on('open', () => {
        resolve();
      });
    });

    const channelSend = (content) => {
      connection.send(content, (err) => {
        console.log(err);
      });
    };
    const channel = new WSChannel(channelSend, 'TEST_CHANNEL_ID');
    connection.on('message', (msg) => {
      const msgObj = JSON.parse(msg as string);
      if (msgObj.kind === 'ready') {
        if (msgObj.id === 'TEST_CHANNEL_ID') {
          channel.handleMessage(msgObj);
        }
      }
    });

    await new Promise((resolve) => {
      channel.onOpen(() => {
        resolve();
      });
      channel.open('TEST_CHANNEL');
    });

    expect(mockHandler.mock.calls.length).toBe(1);

    done();
  });
});
