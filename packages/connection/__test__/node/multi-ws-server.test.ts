import {
  WebSocketServerRoute,
  CommonChannelHandler,
  commonChannelPathHandler,
} from '../../src/node';
import { ChildConnectPath, WSChannel } from '../../src/common/ws-channel';
import { parse } from '../../src/common/utils';

import * as ws from 'ws';
import * as http from 'http';
const WebSocket = ws;

describe('connection', () => {
  it('websocket connection route', async (done) => {
    const server = http.createServer();
    const socketRoute = new WebSocketServerRoute(server, console);
    const channelHandler = new CommonChannelHandler('/service', console, true);
    const connectPath = new ChildConnectPath();
    socketRoute.registerHandler(channelHandler);
    socketRoute.init();

    await new Promise((resolve) => {
      server.listen(7789, () => {
        resolve();
      });
    });

    const mockHandler = jest.fn();
    commonChannelPathHandler.register('TEST_CHANNEL', {
      handler: mockHandler,
      dispose: () => {},
    });

    const connection = new WebSocket(`ws://127.0.0.1:7789/service/${connectPath.getConnectPath(0, '')}`,  ['clientID']);

    await new Promise((resolve) => {
      connection.on('open', () => {
        resolve();
      });
    });

    const channelSend = (content) => {
      connection.send(content, (err) => {});
    };
    const channel = new WSChannel(channelSend, 'TEST_CHANNEL_ID');
    connection.on('message', (msg) => {
      const msgObj = parse(msg as string);
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
    server.close();

    done();
  });
});
