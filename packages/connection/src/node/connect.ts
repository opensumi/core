import type net from 'net';

import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

import { ChannelMessage, WSChannel, parse } from '../common';
import { BinaryConnection } from '../common/binary-rpc/connection';

export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}

const clientId = 'node-socket-connection';
export function createSocketChannel(socket: net.Socket) {
  const channel = new WSChannel((content) => {
    socket.write(content);
  }, clientId);

  channel.open('default');
  socket.on('data', (data) => {
    let msgObj: ChannelMessage;

    try {
      msgObj = parse(data);
      if (msgObj.kind === 'data' || msgObj.kind === 'binary') {
        channel.handleMessage(msgObj);
      }
    } catch (error) {}
  });

  return channel;
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
