import net from 'net';

import { WSChannel } from '@opensumi/ide-connection';
import { NetSocketConnection } from '@opensumi/ide-connection/lib/common/connection';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/lib/utils/ipc';

describe('ws channel node', () => {
  it('works on net.Socket', async () => {
    const ipcPath = await normalizedIpcHandlerPathAsync('test', true);

    const server = new net.Server();

    server.on('connection', (socket) => {
      const channel1 = WSChannel.forClient(new NetSocketConnection(socket), {
        id: 'channel1',
        tag: 'test',
      });
      channel1.send('hello');
    });

    server.listen(ipcPath);

    const socket2 = net.createConnection(ipcPath);

    const channel2 = WSChannel.forClient(new NetSocketConnection(socket2), {
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
});
