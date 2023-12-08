import type net from 'net';

import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

import { SocketChannel } from '../common';

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}

const clientId = 'node-socket-connection';

export function createSocketChannel(socket: net.Socket) {
  const channel = new SocketChannel((content) => {
    socket.write(content);
  }, clientId);

  channel.open('default');
  socket.on('data', (data) => {
    channel.handleServerResponseForNode(data);
  });

  return channel;
}
