import { ReconnectingWebSocketConnection } from '@opensumi/ide-connection/lib/common/connection/drivers/reconnecting-websocket';
import { Server, WebSocket } from '@opensumi/mock-socket';

import { WSChannelHandler } from '../../src/browser/ws-channel-handler';
import { parse, stringify } from '../../src/common/ws-channel';
(global as any).WebSocket = WebSocket;

const randomPortFn = () => Math.floor(Math.random() * 10000) + 10000;

const randomPort = randomPortFn();

describe('connection browser', () => {
  it(
    'init connection',
    async () => {
      const fakeWSURL = `ws://127.0.0.1:${randomPort}`;
      const mockServer = new Server(fakeWSURL);

      let receivedHeartbeat = false;
      mockServer.on('connection', (socket) => {
        socket.on('message', (msg) => {
          const msgObj = parse(msg as Uint8Array);
          if (msgObj.kind === 'open') {
            socket.send(
              stringify({
                id: msgObj.id,
                kind: 'server-ready',
              }),
            );
          } else if (msgObj.kind === 'ping') {
            receivedHeartbeat = true;
          }
        });
      });

      const wsChannelHandler = new WSChannelHandler(
        ReconnectingWebSocketConnection.forURL(fakeWSURL),
        console,
        'test-client-id',
      );

      await wsChannelHandler.initHandler();
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 12000);
      });
      expect(receivedHeartbeat).toBe(true);
      receivedHeartbeat = false;

      const channel = await wsChannelHandler.openChannel('test');

      expect(channel).not.toBeNull();

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 4000);
      });
      // 第七秒后有请求，则不需要再发送心跳
      expect(receivedHeartbeat).toBe(false);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });
      expect(receivedHeartbeat).toBe(true);

      mockServer.close();
      wsChannelHandler.dispose();
    },
    30 * 1000,
  );
});
