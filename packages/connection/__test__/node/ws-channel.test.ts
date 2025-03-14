import net from 'net';

import { IWSChannelCreateOptions } from '@opensumi/ide-connection';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';

import { copy } from '../../src/common/buffers/buffers';
import { NetSocketConnection } from '../../src/common/connection';
import { createWSChannelForClient } from '../common/ws-channel';

const total = 1000;

const createWSChannel = (socket: net.Socket, options: IWSChannelCreateOptions) => {
  const wsConnection = new NetSocketConnection(socket);
  return createWSChannelForClient(wsConnection, options);
};

describe('ws channel node', () => {
  it('works on net.Socket', async () => {
    const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

    const server = new net.Server();

    server.on('connection', (socket) => {
      const channel1 = createWSChannel(socket, {
        id: 'channel1',
      });
      channel1.send('hello');
    });

    server.listen(ipcPath);

    const socket2 = net.createConnection(ipcPath);

    const channel2 = createWSChannel(socket2, {
      id: 'channel2',
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

  it(
    '[send text] communicate with each other N times',
    async () => {
      let count = 0;

      const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

      const server = new net.Server();

      server.on('connection', (socket) => {
        const channel1 = createWSChannel(socket, {
          id: 'channel1',
        });
        channel1.onMessage((d) => {
          channel1.send(d + 'resp');
        });
      });

      server.listen(ipcPath);

      const socket2 = net.createConnection(ipcPath);

      const channel2 = createWSChannel(socket2, {
        id: 'channel2',
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
    },
    20 * 1000,
  );

  it(
    '[send binary] communicate with each other N times',
    async () => {
      let count = 0;

      const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

      const server = new net.Server();

      server.on('connection', (socket) => {
        const channel1 = createWSChannel(socket, {
          id: 'channel1',
        });
        channel1.onBinary((d) => {
          const newBuffer = Buffer.alloc(d.length + 4);
          newBuffer.writeUInt32BE(d.length, 0);
          copy(d, newBuffer, 4);
          channel1.sendBinary(newBuffer);
        });
      });

      server.listen(ipcPath);

      const socket2 = net.createConnection(ipcPath);

      const channel2 = createWSChannel(socket2, {
        id: 'channel2',
      });
      const helloBinary = Buffer.from('hello');

      await Promise.all([
        new Promise<void>((resolve) => {
          channel2.onBinary(() => {
            count++;
            if (count === total) {
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          for (let i = 0; i < total; i++) {
            channel2.sendBinary(helloBinary);
          }
          resolve();
        }),
      ]);

      server.close();
      socket2.destroy();
      socket2.end();
    },
    20 * 1000,
  );
});
