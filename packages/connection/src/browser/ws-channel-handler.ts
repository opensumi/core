import { EventEmitter } from '@opensumi/events';
import { RuntimeSocketConnection } from '@opensumi/ide-core-browser/lib/application/runtime/base-socket';
import { Barrier, Deferred, DisposableStore, IReporterService, MultiMap, REPORT_NAME } from '@opensumi/ide-core-common';

import { ConnectionInfo, WSCloseInfo } from '../common/types';
import { ErrorMessageCode, WSChannel, parse, pingMessage } from '../common/ws-channel';

/**
 * Channel Handler in browser
 */
export class WSChannelHandler {
  private _disposables = new DisposableStore();

  private _onChannelCreatedEmitter = this._disposables.add(new EventEmitter<Record<string, [WSChannel]>>());
  public onChannelCreated(path: string, listener: (channel: WSChannel) => void) {
    return this._onChannelCreatedEmitter.on(path, listener);
  }

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

  constructor(public connection: RuntimeSocketConnection<Uint8Array>, logger: any, clientId: string) {
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
        case 'error':
          this.logger.error(this.LOG_TAG, `receive error: id: ${msg.id}, code: ${msg.code}, error: ${msg.message}`);
          switch (msg.code) {
            case ErrorMessageCode.ChannelNotFound:
              if (this.channelMap.has(msg.id)) {
                // 如果远程报错 channel 不存在但是本机存在，则重新打开
                const channel = this.channelMap.get(msg.id)!;
                if (channel.channelPath) {
                  channel.pause();
                  channel.open(channel.channelPath, this.clientId);
                }
              }
              break;
          }
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
        channel.close(code, reason);
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

  private fillKey(channelPath: string) {
    return `${this.clientId}:${channelPath}`;
  }

  public getChannel(channelPath: string) {
    return this.channelMap.get(this.fillKey(channelPath));
  }

  public async openChannel(channelPath: string) {
    const key = this.fillKey(channelPath);
    if (this.channelMap.has(key)) {
      this.channelMap.get(key)!.dispose();
      this.logger.log(this.LOG_TAG, `channel ${key} already exists, dispose it`);
    }

    const channel = new WSChannel(this.connection, {
      id: key,
      logger: this.logger,
      ensureServerReady: true,
    });
    this.channelMap.set(channel.id, channel);
    this._onChannelCreatedEmitter.emit(channelPath, channel);

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
      this.logger.log(this.LOG_TAG, `channel ${channelPath} closed, code: ${code}, reason: ${reason}`);
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
    this._disposables.dispose();
  }

  awaitChannelReady(channelPath: string) {
    const channel = this.getChannel(channelPath);
    const deferred = new Deferred<void>();
    if (channel) {
      channel.onServerReady(() => {
        deferred.resolve();
      });
    } else {
      const dispose = this.onChannelCreated(channelPath, (channel) => {
        channel.onServerReady(() => {
          deferred.resolve();
        });
        dispose.dispose();
      });
    }
    return deferred.promise;
  }
}
