import type net from 'net';

import type WebSocket from 'ws';

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

export function createSocketChannelForWS(socket: WebSocket, _clientId: string) {
  const channel = new SocketChannel((content) => {
    socket.send(content);
  }, _clientId);

  channel.open('default');

  socket.on('message', (data) => {
    channel.handleServerResponseForNode(data as Buffer);
  });

  return channel;
}
