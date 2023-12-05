import type net from 'net';

import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

import { BinaryConnection } from '../common/binary-connection';

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}

export function createBinaryConnection(socket: net.Socket) {
  return new BinaryConnection({
    onmessage: (cb) => {
      const handler = (data: Buffer) => {
        cb(data);
      };
      socket.on('data', handler);
      return {
        dispose() {
          socket.off('data', handler);
        },
      };
    },
    send(data) {
      socket.write(data);
    },
  });
}
