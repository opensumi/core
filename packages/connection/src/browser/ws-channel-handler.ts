import ReconnectingWebSocket from 'reconnecting-websocket';

import { uuid } from '@opensumi/ide-core-common';
import { IReporterService, REPORT_NAME, UrlProvider } from '@opensumi/ide-core-common';

import { stringify, parse, WSCloseInfo, ConnectionInfo } from '../common/utils';
import { WSChannel, MessageString } from '../common/ws-channel';

// 前台链接管理类
export class WSChannelHandler {
  public connection: WebSocket;
  private channelMap: Map<number | string, WSChannel> = new Map();
  private channelCloseEventMap: Map<number | string, WSCloseInfo> = new Map();
  private logger = console;
  public clientId: string;
  private heartbeatMessageTimer: NodeJS.Timer | null;
  private reporterService: IReporterService;

  constructor(public wsPath: UrlProvider, logger: any, public protocols?: string[], clientId?: string) {
    this.logger = logger || this.logger;
    this.clientId = clientId || `CLIENT_ID_${uuid()}`;
    this.connection = new ReconnectingWebSocket(wsPath, protocols, {}) as WebSocket; // new WebSocket(wsPath, protocols);
  }
  // 为解决建立连接之后，替换成可落盘的 logger
  replaceLogger(logger: any) {
    if (logger) {
      this.logger = logger;
    }
  }
  setReporter(reporterService: IReporterService) {
    this.reporterService = reporterService;
  }
  private clientMessage() {
    const clientMsg: MessageString = stringify({
      kind: 'client',
      clientId: this.clientId,
    });
    this.connection.send(clientMsg);
  }
  private heartbeatMessage() {
    if (this.heartbeatMessageTimer) {
      clearTimeout(this.heartbeatMessageTimer);
    }
    this.heartbeatMessageTimer = global.setTimeout(() => {
      const msg = stringify({
        kind: 'heartbeat',
        clientId: this.clientId,
      });
      this.connection.send(msg);
      this.heartbeatMessage();
    }, 5000);
  }

  public async initHandler() {
    this.connection.onmessage = (e) => {
      // 一个心跳周期内如果有收到消息，则不需要再发送心跳
      this.heartbeatMessage();

      const msg = parse(e.data);

      if (msg.id) {
        const channel = this.channelMap.get(msg.id);
        if (channel) {
          if (msg.kind === 'data' && !(channel as any).fireMessage) {
            // 要求前端发送初始化消息，但后端最先发送消息时，前端并未准备好
            this.logger.error('channel not ready!', msg);
          }
          channel.handleMessage(msg);
        } else {
          this.logger.warn(`channel ${msg.id} not found`);
        }
      }
    };
    await new Promise((resolve) => {
      this.connection.addEventListener('open', () => {
        this.clientMessage();
        this.heartbeatMessage();
        resolve(undefined);
        // 重连 channel
        if (this.channelMap.size) {
          this.channelMap.forEach((channel) => {
            channel.onOpen(() => {
              const closeInfo = this.channelCloseEventMap.get(channel.id);
              this.reporterService &&
                this.reporterService.point(REPORT_NAME.CHANNEL_RECONNECT, REPORT_NAME.CHANNEL_RECONNECT, closeInfo);
              this.logger && this.logger.log(`channel reconnect ${this.clientId}:${channel.channelPath}`);
            });
            channel.open(channel.channelPath);

            // 针对前端需要重新设置下后台状态的情况
            if (channel.fireReOpen) {
              channel.fireReOpen();
            }
          });
        }
      });

      this.connection.addEventListener('close', (event) => {
        if (this.channelMap.size) {
          this.channelMap.forEach((channel) => {
            channel.close(event.code, event.reason);
          });
        }
      });
    });
  }
  private getChannelSend = (connection) => (content: string) => {
    connection.send(content, (err: Error) => {
      if (err) {
        this.logger.warn(err);
      }
    });
  };
  public async openChannel(channelPath: string) {
    const channelSend = this.getChannelSend(this.connection);
    const channelId = `${this.clientId}:${channelPath}`;
    const channel = new WSChannel(channelSend, channelId);
    this.channelMap.set(channel.id, channel);

    await new Promise((resolve) => {
      channel.onOpen(() => {
        resolve(undefined);
      });
      channel.onClose((code: number, reason: string) => {
        this.channelCloseEventMap.set(channelId, {
          channelPath,
          closeEvent: { code, reason },
          connectInfo: (navigator as any).connection as ConnectionInfo,
        });
        this.logger.log('channel close: ', code, reason);
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
