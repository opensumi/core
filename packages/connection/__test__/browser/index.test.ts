import { furySerializer } from '@opensumi/ide-connection';
import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
import { sleep } from '@opensumi/ide-core-common';
import { Server, WebSocket } from '@opensumi/mock-socket';

import { WSChannelHandler } from '../../src/browser/ws-channel-handler';
(global as any).WebSocket = WebSocket;

const randomPortFn = () => Math.floor(Math.random() * 10000) + 10000;

const randomPort = randomPortFn();

describe('connection browser', () => {
  it(
    'init connection',
    async () => {
      const fakeWSURL = `ws://127.0.0.1:${randomPort}`;
      const mockServer = new Server(fakeWSURL);

      let data1Received = false;
      let data2Received = false;

      mockServer.on('connection', (socket) => {
        socket.on('message', (msg) => {
          const msgObj = furySerializer.deserialize(msg as Uint8Array);
          if (msgObj.kind === 'open') {
            socket.send(
              furySerializer.serialize({
                id: msgObj.id,
                kind: 'server-ready',
                token: '',
              }),
            );
          } else if (msgObj.kind === 'data') {
            const data = msgObj.content;
            if (data === 'data1') {
              data1Received = true;
            }
            if (data === 'data2') {
              data2Received = true;
            }
          }
        });
      });

      const wsChannelHandler = new WSChannelHandler(
        ReconnectingWebSocketConnection.forURL(fakeWSURL),
        'test-client-id',
      );

      await wsChannelHandler.initHandler();

      const channel = await wsChannelHandler.openChannel('test');

      expect(channel).not.toBeNull();

      await channel.send('data1');
      await sleep(500);
      expect(data1Received).toBe(true);

      channel.close();
      await channel.send('data2');
      await sleep(500);
      // 此时收不到，因为 channel 已经关闭
      expect(data2Received).toBe(false);
      channel.dispatch({
        kind: 'server-ready',
        id: 'test',
        token: '',
      });
      await sleep(500);
      // message queue flushed
      expect(data2Received).toBe(true);

      mockServer.close();
      wsChannelHandler.dispose();
    },
    20 * 1000,
  );
});
