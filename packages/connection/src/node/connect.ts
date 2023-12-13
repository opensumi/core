import type net from 'net';

import type WebSocket from 'ws';

import { ILogger } from '@opensumi/ide-core-common';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';
import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

import { SocketChannel, parse } from '../common';

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}

function handleServerResponseForNode(socketChannel: SocketChannel, data: PlatformBuffer) {
  const msgObj = parse(data);
  socketChannel.handleMessage(msgObj);
  return msgObj;
}

const clientId = 'node-socket-connection';

export function createSocketChannel(socket: net.Socket, logger?: ILogger) {
  const id = `${clientId}-${Math.random().toString(36).substring(2, 8)}`;
  const channel = new SocketChannel(
    (content) => {
      socket.write(content);
    },
    { id, logger, tag: 'node-socket' },
  );

  // @types/node 10.x 版本的类型定义中没有 readyState 属性
  if ((socket as any).readyState === 'open') {
    channel.open('default');
  } else {
    socket.on('connect', () => {
      channel.open('default');
    });
  }

  const dataHandler = (data: PlatformBuffer) => {
    try {
      handleServerResponseForNode(channel, data);
    } catch (error) {
      logger?.error(`[createSocketChannel] [${id}]`, error);
    }
  };

  socket.on('data', dataHandler);
  socket.once('close', () => {
    socket.off('data', dataHandler);
    channel.dispose();
  });

  return channel;
}

export function createSocketChannelForWS(socket: WebSocket, _clientId: string) {
  const channel = new SocketChannel(
    (content) => {
      socket.send(content);
    },
    { id: _clientId, tag: 'node-ws-socket' },
  );

  channel.open('default');

  socket.on('message', (data: PlatformBuffer) => {
    handleServerResponseForNode(channel, data);
  });

  return channel;
}
