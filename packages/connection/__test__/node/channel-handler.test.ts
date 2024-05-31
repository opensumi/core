import net from 'net';

import { commonChannelPathHandler } from '@opensumi/ide-connection/lib/node';
import { NetSocketConnection } from '@opensumi/ide-connection/src/common/connection';
import { ElectronChannelHandler } from '@opensumi/ide-connection/src/electron';
import { Deferred } from '@opensumi/ide-core-common';
import { normalizedIpcHandlerPathAsync } from '@opensumi/ide-core-common/src/utils/ipc';

// eslint-disable-next-line import/no-restricted-paths
import { WSChannelHandler } from '../../src/browser';

const clientId = 'test-client-id';

describe('channel handler', () => {
  it('can handle websocket channel', async () => {
    expect.assertions(2);

    const server = new net.Server();
    const ipcPath = await normalizedIpcHandlerPathAsync('test', true);
    server.listen(ipcPath);

    const nodeChannelHandler = new ElectronChannelHandler(server);
    nodeChannelHandler.listen();

    commonChannelPathHandler.register('test', {
      handler(channel, connectionId, params) {
        channel.onMessage((msg) => {
          if (msg === 'hello') {
            channel.send('world');
          }
        });
      },
      dispose() {},
    });

    commonChannelPathHandler.register('test2', {
      handler(channel, connectionId, params) {
        channel.onMessage((msg) => {
          if (msg === 'ping') {
            channel.send('pong');
          }
        });
      },
      dispose() {},
    });

    const socket = new net.Socket();
    socket.connect(ipcPath);
    const connection = new NetSocketConnection(socket);
    const browserChannel = new WSChannelHandler(connection, clientId);

    await browserChannel.initHandler();

    const testChannel = await browserChannel.openChannel('test');
    const testChannel2 = await browserChannel.openChannel('test2');

    const deferred = new Deferred<void>();

    testChannel.onMessage((msg) => {
      expect(msg).toBe('world');
      deferred.resolve();
    });
    testChannel.send('hello');

    const deferred2 = new Deferred<void>();
    testChannel2.onMessage((msg) => {
      expect(msg).toBe('pong');
      deferred2.resolve();
    });
    testChannel2.send('ping');

    await deferred.promise;
    await deferred2.promise;

    connection.dispose();
    connection.destroy();
    server.close();
  });
});
