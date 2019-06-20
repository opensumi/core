import {WSChannel} from '../common/ws-channel';
import * as shorid from 'shortid';

export class WSChanneHandler {
  private connection: WebSocket;
  private channelMap: Map<number|string, WSChannel> = new Map();
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
    const channelId = shorid.generate();
    const channel = new WSChannel(channelSend, channelId);
    this.channelMap.set(channel.id, channel);

    await new Promise((resolve) => {
      channel.onOpen(() => {
        resolve();
      });
      channel.open(channelPath);
    });

    return channel;
  }

}
