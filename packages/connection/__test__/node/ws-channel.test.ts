import net from 'net';

import { WSChannel } from '@opensumi/ide-connection';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';
const total = 1000;

describe('ws channel node', () => {
  it('works on net.Socket', async () => {
    const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

    const server = new net.Server();

    server.on('connection', (socket) => {
      const channel1 = WSChannel.forNetSocket(socket, {
        id: 'channel1',
        tag: 'test',
      });
      channel1.send('hello');
    });

    server.listen(ipcPath);

    const socket2 = net.createConnection(ipcPath);

    const channel2 = WSChannel.forNetSocket(socket2, {
      id: 'channel2',
      tag: 'test',
    });

    const msg = await new Promise<string>((resolve) => {
      channel2.onMessage((data) => {
        resolve(data);
      });
    });

    expect(msg).toEqual('hello');

    server.close();
    socket2.destroy();
    socket2.end();
  });

  it(`互相通信 N 次(N = ${total})`, async () => {
    jest.setTimeout(20 * 1000);

    let count = 0;

    const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

    const server = new net.Server();

    server.on('connection', (socket) => {
      const channel1 = WSChannel.forNetSocket(socket, {
        id: 'channel1',
        tag: 'test',
      });
      channel1.onMessage((d) => {
        channel1.send(d + 'resp');
      });
    });

    server.listen(ipcPath);

    const socket2 = net.createConnection(ipcPath);

    const channel2 = WSChannel.forNetSocket(socket2, {
      id: 'channel2',
      tag: 'test',
    });

    await Promise.all([
      new Promise<void>((resolve) => {
        channel2.onMessage(() => {
          count++;
          if (count === total) {
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        for (let i = 0; i < total; i++) {
          channel2.send('hello');
        }
        resolve();
      }),
    ]);

    server.close();
    socket2.destroy();
    socket2.end();
  });
});
