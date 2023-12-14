import { ILogger, parse } from '../common';
import { IConnectionShape } from '../common/connection/types';
import { ChannelMessage, TConnectionSend, WSChannel } from '../common/ws-channel';

export class SimpleCommonChannelHandler {
  channelMap = new Map<string, WSChannel>();

  constructor(public name: string, private logger: ILogger) {}

  getOrCreateChannel(
    clientId: string,
    options?: {
      connectionSend?: TConnectionSend;
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
    socket: IConnectionShape<Uint8Array>,
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
      connectionSend: (content: Uint8Array) => {
        socket.send(content);
      },
      onSocketChannel,
    };

    const toDispose = socket.onMessage((data) => {
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
    socket.onceClose(() => {
      toDispose.dispose();
    });
  }
}
