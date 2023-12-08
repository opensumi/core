import { IDisposable } from '@opensumi/ide-core-common';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { ChannelMessage, SocketChannel, parse } from './socket-channel';
import { IBinaryConnectionSocket } from './sumi-rpc';
import { ILogger } from './types';

export interface ICommonHandlerSocket {
  send(data: PlatformBuffer): void;
  onmessage: (cb: (data: PlatformBuffer) => void) => IDisposable | void;
}

export type ICommonHandlerConnectionSend = (content: PlatformBuffer) => void;

export class SimpleCommonChannelHandler {
  channelMap = new Map<string, SocketChannel>();

  constructor(public name: string, private logger: ILogger) {}

  getOrCreateChannel(clientId: string, connectionSend?: ICommonHandlerConnectionSend) {
    let channel = this.channelMap.get(clientId);
    if (!channel && connectionSend) {
      channel = new SocketChannel(connectionSend, clientId);
      this.channelMap.set(clientId, channel);
    }
    return channel;
  }

  handleSocket(
    socket: IBinaryConnectionSocket,
    options: {
      onSocketChannel(channel: SocketChannel): void;
    },
  ) {
    socket.onmessage((data) => {
      let msgObj: ChannelMessage;

      try {
        msgObj = parse(data);
        if (msgObj.kind === 'open') {
          const channel = this.getOrCreateChannel(msgObj.id, (content) => {
            socket.send(content);
          })!;
          options.onSocketChannel(channel);
        } else if (msgObj.kind === 'data' || msgObj.kind === 'binary') {
          const channel = this.getOrCreateChannel(msgObj.id);
          if (!channel) {
            this.logger.error(`channel ${msgObj.id} not found`);
            return;
          }

          channel.handleMessage(msgObj);
        }
      } catch (error) {}
    });
  }
}
