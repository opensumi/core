import ReconnectingWebSocket from 'reconnecting-websocket';

import { uuid } from '@opensumi/ide-core-common';
import { IReporterService, REPORT_NAME, UrlProvider } from '@opensumi/ide-core-common';

import { stringify, parse, WSCloseInfo, ConnectionInfo } from '../common/utils';
import { WSChannel, MessageString } from '../common/ws-channel';

// 前台链接管理类
export class WSChannelHandler {
  public connection: ReconnectingWebSocket;
  private channelMap: Map<number | string, WSChannel> = new Map();
  private channelCloseEventMap: Map<number | string, WSCloseInfo> = new Map();
  private logger = console;
  public clientId: string;
  private heartbeatMessageTimer: NodeJS.Timer | null;
  private reporterService: IReporterService;

  get LOG_TAG() {
    return `[WSChannelHandler] [client-id:${this.clientId}] [ws-path:${this.wsPath}]`;
  }

  constructor(public wsPath: UrlProvider, logger: any, public protocols?: string[], clientId?: string) {
    this.logger = logger || this.logger;
    this.clientId = clientId || `CLIENT_ID_${uuid()}`;
    this.connection = new ReconnectingWebSocket(wsPath, protocols, {});
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
      id: this.clientId,
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
        id: this.clientId,
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
          if (msg.kind === 'data' && !channel.hasMessageListener()) {
            // 要求前端发送初始化消息，但后端最先发送消息时，前端并未准备好
            this.logger.error(this.LOG_TAG, 'channel not ready!', msg);
          }
          channel.handleMessage(msg);
        } else {
          this.logger.warn(this.LOG_TAG, `channel ${msg.id} not found`);
        }
      }
    };
    await new Promise<void>((resolve) => {
      this.connection.addEventListener('open', () => {
        this.clientMessage();
        this.heartbeatMessage();
        resolve();
        // 重连 channel
        if (this.channelMap.size) {
          this.channelMap.forEach((channel) => {
            channel.onOpen(() => {
              const closeInfo = this.channelCloseEventMap.get(channel.id);
              this.reporterService &&
                this.reporterService.point(REPORT_NAME.CHANNEL_RECONNECT, REPORT_NAME.CHANNEL_RECONNECT, closeInfo);
              this.logger.log(this.LOG_TAG, `channel reconnect ${this.clientId}:${channel.channelPath}`);
            });

            channel.open(channel.channelPath);
            // 针对前端需要重新设置下后台状态的情况
            channel.fireReOpen();
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
  private getChannelSend = (connection: ReconnectingWebSocket) => (content: string) => {
    connection.send(content);
  };
  public async openChannel(channelPath: string) {
    const channelSend = this.getChannelSend(this.connection);
    const channelId = `${this.clientId}:${channelPath}`;
    const channel = new WSChannel(channelSend, {
      id: channelId,
      logger: this.logger,
      tag: 'browser-ws-client-handler',
    });
    this.channelMap.set(channel.id, channel);

    await new Promise<void>((resolve) => {
      channel.onOpen(() => {
        resolve();
      });
      channel.onClose((code: number, reason: string) => {
        this.channelCloseEventMap.set(channelId, {
          channelPath,
          closeEvent: { code, reason },
          connectInfo: (navigator as any).connection as ConnectionInfo,
        });
        this.logger.log(this.LOG_TAG, 'channel close: ', code, reason);
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
