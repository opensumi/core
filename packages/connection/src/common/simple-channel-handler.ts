import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { IBinaryConnectionSocket } from './sumi-rpc';
import { ILogger } from './types';
import { ChannelMessage, WSChannel, parse } from './ws-channel';

export type ICommonHandlerConnectionSend = (content: PlatformBuffer) => void;

export class SimpleCommonChannelHandler {
  channelMap = new Map<string, WSChannel>();

  constructor(public name: string, private logger: ILogger) {}

  getOrCreateChannel(
    clientId: string,
    options?: {
      connectionSend?: ICommonHandlerConnectionSend;
      onSocketChannel?(channel: WSChannel): void;
    },
  ): WSChannel {
    let channel = this.channelMap.get(clientId);
    if (!channel && options?.connectionSend) {
      channel = new WSChannel(options.connectionSend, { id: clientId, tag: 'simple-common-handler' });
      this.channelMap.set(clientId, channel);
      options.onSocketChannel?.(channel);
    }
    return channel!;
  }

  handleSocket(
    socket: IBinaryConnectionSocket,
    options: {
      onSocketChannel(channel: WSChannel): void;
      onError(error: Error): void;
    },
  ) {
    const onSocketChannel = (channel: WSChannel) => {
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
