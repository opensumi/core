import {WSChanneHandler} from '../../src/browser/ws-channel-handler';
import { WebSocket, Server } from 'mock-socket';
(global as any).WebSocket = WebSocket;

describe('connection browser', () => {
  it('init connection', async (done) => {

    jest.setTimeout(20000);

    const fakeWSURL = 'ws://localhost:8089';
    const mockServer = new Server(fakeWSURL);
    // TODO: 增加消息发送测试

    mockServer.on('connection', (socket) => {
      socket.on('message', (msg) => {
        const msgObj = JSON.parse(msg as string);
        if (msgObj.kind === 'open') {
          socket.send(JSON.stringify({
            id: msgObj.id,
            kind: 'ready',
          }));
        }
      });
    });

    const wsChannelHandler = new WSChanneHandler(fakeWSURL, {
      setBackgroundColor: () => {},
    });

    await wsChannelHandler.initHandler();
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 7000);
    });

    const channel = await wsChannelHandler.openChannel('test');

    expect(channel).not.toBeNull();

    mockServer.close();
    wsChannelHandler.dispose();
    done();
  });
});
