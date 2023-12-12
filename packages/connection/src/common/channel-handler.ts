import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { ChannelMessage, SocketChannel, parse } from './socket-channel';
import { IBinaryConnectionSocket } from './sumi-rpc';
import { ILogger } from './types';

export type ICommonHandlerConnectionSend = (content: PlatformBuffer) => void;

export class SimpleCommonChannelHandler {
  channelMap = new Map<string, SocketChannel>();

  constructor(public name: string, private logger: ILogger) {}

  getOrCreateChannel(
    clientId: string,
    options?: {
      connectionSend?: ICommonHandlerConnectionSend;
      onSocketChannel?(channel: SocketChannel): void;
    },
  ): SocketChannel {
    let channel = this.channelMap.get(clientId);
    if (!channel && options?.connectionSend) {
      channel = new SocketChannel(options.connectionSend, { id: clientId, tag: 'simple-common-handler' });
      this.channelMap.set(clientId, channel);
      options.onSocketChannel?.(channel);
    }
    return channel!;
  }

  handleSocket(
    socket: IBinaryConnectionSocket,
    options: {
      onSocketChannel(channel: SocketChannel): void;
      onError(error: Error): void;
    },
  ) {
    const onSocketChannel = (channel: SocketChannel) => {
      channel.ready();

      if (options.onSocketChannel) {
        options.onSocketChannel(channel);
      }
    };

    const createOptions = {
      connectionSend: (content: PlatformBuffer) => {
        socket.send(content);
      },
      onSocketChannel,
    };

    return socket.onmessage((data) => {
      let msgObj: ChannelMessage;

      try {
        msgObj = parse(data);
        this.logger.log(`[handleSocket] [${this.name}] [${msgObj.kind}]`, msgObj);

        const channel = this.getOrCreateChannel(msgObj.id, createOptions);

        channel.handleMessage(msgObj);
      } catch (error) {
        this.logger.error(`handle socket message error: ${error}`);
        options.onError(error);
      }
    });
  }
}
