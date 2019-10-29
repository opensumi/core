import {WSChannel} from '../common/ws-channel';
import * as shorid from 'shortid';
let ReconnectingWebSocket = require('reconnecting-websocket');

if (ReconnectingWebSocket.default) {
  /* istanbul ignore next */
  ReconnectingWebSocket = ReconnectingWebSocket.default;
}
// import ReconnectingWebSocket from 'reconnecting-websocket';
// import { IStatusBarService } from '@ali/ide-core-browser/lib/services';

// 前台链接管理类
export class WSChanneHandler {
  static CLOSESTATUSCOLOR = '#ff0000';

  private connection: WebSocket;
  private channelMap: Map<number|string, WSChannel> = new Map();
  private logger = console;
  public clientId: string = `CLIENT_ID:${shorid.generate()}`;
  private heartbeatMessageTimer: NodeJS.Timeout;

  constructor(public wsPath: string, public statusBarService, public protocols?: string[]) {
    this.connection = new ReconnectingWebSocket(wsPath, protocols, {}); // new WebSocket(wsPath, protocols);
  }
  private clientMessage() {
    const clientMsg =  JSON.stringify({
      kind: 'client',
      clientId: this.clientId,
    });
    this.connection.send(clientMsg);
  }
  private heartbeatMessage() {
    this.heartbeatMessageTimer = setTimeout(() => {
      const msg = JSON.stringify({
        kind: 'heartbeat',
        clientId: this.clientId,
      });
      this.connection.send(msg);
      this.heartbeatMessage();
    }, 5000);
  }

  public async initHandler() {
    this.connection.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.id) {
        const channel = this.channelMap.get(msg.id);
        if (channel) {
          channel.handleMessage(msg);
        } else {
          this.logger.log(`channel ${msg.id} not found`);
        }
      }
    };
    await new Promise((resolve) => {
      this.connection.onopen = () => {

        this.clientMessage();
        this.heartbeatMessage();
        resolve();

        // 重连 channel
        /* FIXME: 暂时不需要，直接通过重新生成实例
        if (this.channelMap.size) {
          this.channelMap.forEach((channel) => {
            channel.onOpen(() => {
              console.log(`channel reconnect ${this.clientId}:${channel.channelPath}`);
            });
            channel.open(channel.channelPath);
            if (channel.fireReOpen) {
              channel.fireReOpen();
            }
          });
        }
        */

        this.statusBarService.setBackgroundColor('var(--statusBar-background)');
      };

      this.connection.onclose = () => {
        this.statusBarService.setBackgroundColor(WSChanneHandler.CLOSESTATUSCOLOR);
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
    const channelId = `${this.clientId}:CHANNEL_ID:${channelPath}_${shorid.generate()}`;
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

  public dispose() {
    if (this.heartbeatMessageTimer) {
      clearTimeout(this.heartbeatMessageTimer);
    }
  }

}
