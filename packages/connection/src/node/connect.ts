import type net from 'net';

import type WebSocket from 'ws';

import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';
import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

import { ChannelMessage, SocketChannel, parse } from '../common';

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}

function handleServerResponseForNode(socketChannel: SocketChannel, data: PlatformBuffer) {
  let msgObj: ChannelMessage;

  try {
    msgObj = parse(data);
    if (msgObj.kind === 'data' || msgObj.kind === 'binary') {
      socketChannel.handleMessage(msgObj);
    }
  } catch (error) {}
}

const clientId = 'node-socket-connection';

export function createSocketChannel(socket: net.Socket) {
  const id = `${clientId}-${Math.random().toString(36).substring(2, 8)}`;
  const channel = new SocketChannel(
    (content) => {
      socket.write(content);
    },
    { id },
  );

  channel.open('default');
  socket.on('data', (data) => {
    handleServerResponseForNode(channel, data);
  });

  return channel;
}

export function createSocketChannelForWS(socket: WebSocket, _clientId: string) {
  const channel = new SocketChannel(
    (content) => {
      socket.send(content);
    },
    { id: _clientId },
  );

  channel.open('default');
  socket.on('message', (data: PlatformBuffer) => {
    handleServerResponseForNode(channel, data);
  });

  return channel;
}
