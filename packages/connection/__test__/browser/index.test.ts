import { WSChanneHandler } from '../../src/browser/ws-channel-handler';
import { stringify, parse } from '../../src/common/utils';
import { ChildConnectPath } from '../../src/common/ws-channel';
import { WebSocket, Server } from 'mock-socket';
import { ReporterService, DefaultReporter } from '@ali/ide-core-common';
(global as any).WebSocket = WebSocket;

const connectPath = new ChildConnectPath();

describe('connection browser', () => {
  it('init connection', async (done) => {
    jest.setTimeout(20000);

    const fakeWSURL = 'ws://localhost:8089';
    const mockServer = new Server(`${fakeWSURL}/${connectPath.getConnectPath(0, '12')}`);

    let receivedHeartbeat = false;
    mockServer.on('connection', (socket) => {
      socket.on('message', (msg) => {
        const msgObj = parse(msg as string);
        if (msgObj.kind === 'open') {
          socket.send(
            stringify({
              id: msgObj.id,
              kind: 'ready',
            }),
          );
        } else if (msgObj.kind === 'heartbeat') {
          receivedHeartbeat = true;
        }
      });
    });

    const wsChannelHandler = new WSChanneHandler(fakeWSURL, console);

    await wsChannelHandler.initHandler();
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 7000);
    });
    expect(receivedHeartbeat).toBe(true);
    receivedHeartbeat = false;

    const channel = await wsChannelHandler.openChannel('test');

    expect(channel).not.toBeNull();

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 4000);
    });
    // 第七秒后有请求，则不需要再发送心跳
    expect(receivedHeartbeat).toBe(false);

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
    expect(receivedHeartbeat).toBe(true);

    mockServer.close();
    wsChannelHandler.dispose();
    done();
  });
});
