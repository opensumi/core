import {WSChannel} from '../common/ws-channel';

export class WSChanneHandler {
  private connection: WebSocket;
  private channelMap: Map<number, WSChannel> = new Map();
  private logger = console;

  constructor(public wsPath: string) {
    this.connection = new WebSocket(wsPath);
  }
  public async initHandler() {
    this.connection.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      const channel = this.channelMap.get(msg.id);
      if (channel) {
        channel.handleMessage(msg);
      } else {
        this.logger.log(`channel ${msg.id} not found`);
      }
    };
    await new Promise((resolve) => {
      this.connection.onopen = () => {
        resolve();
      };
    });
  }
  private getChannelSend = (connection) => {
    return (content: string) => {
      connection.send(content, (err: Error) => {
        if (err) {
          this.logger.log(err);
        }
      });
    };
  }
  public async openChannel(channelPath: string) {
    const channelSend = this.getChannelSend(this.connection);
    const channel = new WSChannel(channelSend);

    await new Promise((resolve) => {
      channel.onOpen(() => {
        resolve();
      });
      channel.open(channelPath);
    });

    this.channelMap.set(channel.id, channel);
    return channel;
  }

}
