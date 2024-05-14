import { Barrier, Deferred, IReporterService, MultiMap, REPORT_NAME } from '@opensumi/ide-core-common';

import { NetSocketConnection } from '../common/connection';
import { ReconnectingWebSocketConnection } from '../common/connection/drivers/reconnecting-websocket';
import { ConnectionInfo, WSCloseInfo } from '../common/types';
import { WSChannel, parse, pingMessage } from '../common/ws-channel';

/**
 * Channel Handler in browser
 */
export class WSChannelHandler {
  private channelMap: Map<string, WSChannel> = new Map();
  private channelCloseEventMap = new MultiMap<string, WSCloseInfo>();
  private logger = console;
  public clientId: string;
  private heartbeatMessageTimer: NodeJS.Timeout | null;
  private reporterService: IReporterService;

  /**
   * 保证在连接建立后再执行后续操作
   */
  private openingBarrier = new Barrier();

  LOG_TAG: string;

  constructor(public connection: ReconnectingWebSocketConnection | NetSocketConnection, logger: any, clientId: string) {
    this.logger = logger || this.logger;
    this.clientId = clientId;
    this.LOG_TAG = `[WSChannelHandler] [client-id:${this.clientId}]`;
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
  private heartbeatMessage() {
    if (this.heartbeatMessageTimer) {
      clearTimeout(this.heartbeatMessageTimer);
    }
    this.heartbeatMessageTimer = global.setTimeout(() => {
      this.connection.send(pingMessage);
      this.heartbeatMessage();
    }, 10 * 1000);
  }

  public async initHandler() {
    this.connection.onMessage((message) => {
      // 一个心跳周期内如果有收到消息，则不需要再发送心跳
      this.heartbeatMessage();

      const msg = parse(message);

      switch (msg.kind) {
        case 'pong':
          // pong 没有 msg.id, 且不需要分发, 不处理
          break;
        default: {
          const channel = this.channelMap.get(msg.id);
          if (channel) {
            channel.dispatch(msg);
          } else {
            this.logger.warn(this.LOG_TAG, `channel ${msg.id} not found`);
          }
        }
      }
    });

    const reopenExistsChannel = () => {
      if (this.channelMap.size > 0) {
        this.channelMap.forEach((channel) => {
          channel.open(channel.channelPath, this.clientId);
        });
      }
    };

    this.connection.onClose((code, reason) => {
      this.channelMap.forEach((channel) => {
        channel.close(code ?? 1000, reason ?? '');
      });
    });

    if (this.connection.isOpen()) {
      this.heartbeatMessage();
      this.openingBarrier.open();
    }

    this.connection.onOpen(() => {
      this.heartbeatMessage();
      // 说明是重连
      if (this.openingBarrier.isOpen()) {
        reopenExistsChannel();
      } else {
        this.openingBarrier.open();
      }
    });

    await this.openingBarrier.wait();
  }

  public async openChannel(channelPath: string) {
    const key = `${this.clientId}:${channelPath}`;

    const channel = new WSChannel(this.connection, {
      id: key,
      logger: this.logger,
      ensureServerReady: true,
    });
    this.channelMap.set(channel.id, channel);

    let channelOpenedCount = 0;

    channel.onOpen(() => {
      channelOpenedCount++;
      if (channelOpenedCount > 1) {
        channel.fireReopen();
        this.logger.log(
          this.LOG_TAG,
          `channel reconnect ${this.clientId}:${channel.channelPath}, count: ${channelOpenedCount}`,
        );
      } else {
        this.logger.log(this.LOG_TAG, `channel open ${this.clientId}:${channel.channelPath}`);
      }

      const closeInfo = this.channelCloseEventMap.get(channel.id);
      if (closeInfo) {
        closeInfo.forEach((info) => {
          this.reporterService &&
            this.reporterService.point(REPORT_NAME.CHANNEL_RECONNECT, REPORT_NAME.CHANNEL_RECONNECT, info);
        });

        this.channelCloseEventMap.delete(channel.id);
      }
    });

    channel.onClose((code: number, reason: string) => {
      this.channelCloseEventMap.set(channel.id, {
        channelPath,
        closeEvent: { code, reason },
        connectInfo: (navigator as any).connection as ConnectionInfo,
      });
      this.logger.log(this.LOG_TAG, `channel close: code: ${code}, reason: ${reason}`);
    });

    const deferred = new Deferred<void>();

    const dispose = channel.onOpen(() => {
      deferred.resolve();
      dispose.dispose();
    });

    channel.open(channelPath, this.clientId);

    await deferred.promise;

    return channel;
  }

  public dispose() {
    if (this.heartbeatMessageTimer) {
      clearTimeout(this.heartbeatMessageTimer);
    }
  }
}
