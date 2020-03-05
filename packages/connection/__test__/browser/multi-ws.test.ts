import { WSChannelHandler } from '../../src/browser/ws-channel-handler';
import { stringify, parse } from '../../src/common/utils';
import { ChildConnectPath } from '../../src/common/ws-channel';
import { MultiWs } from '../../src/browser/multi-ws';
import { WebSocket, Server } from 'mock-socket';
(global as any).WebSocket = WebSocket;

describe('connection browser', () => {
  it('init connection', async (done) => {
    jest.setTimeout(20000);

    const mockServerList: Server[] = [];
    const fakeWSURL = 'ws://localhost:8090';
    const connectPath = new ChildConnectPath();

    for (let i = 0; i < MultiWs.defaultLength; i++) {
      const mockServer = new Server(`${fakeWSURL}/${connectPath.getConnectPath(i, '')}`);
      mockServerList.push(mockServer);
    }

    let receivedHeartbeat = false;

    mockServerList.forEach((mockServer: Server) => {
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
    });

    const wsChannelHandler = new WSChannelHandler(fakeWSURL, console, undefined, true);

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

    mockServerList.forEach((mockServer: Server) => {
      mockServer.close();
    });
    wsChannelHandler.dispose();
    done();
  });
});
