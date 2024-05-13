import { IConnectionShape } from './connection/types';
import { ILogger } from './types';
import { ChannelMessage, WSChannel, WSServerChannel, parse, pongMessage } from './ws-channel';

export interface IPathHandler {
  dispose: (channel: WSChannel, connectionId: string) => void;
  handler: (channel: WSChannel, connectionId: string, params?: Record<string, string>) => void;
  reconnect?: (channel: WSChannel, connectionId: string) => void;
  connection?: any;
}

export class CommonChannelPathHandler {
  private handlerMap: Map<string, IPathHandler[]> = new Map();
  private paramsKey: Map<string, string> = new Map();

  register(channelPath: string, handler: IPathHandler) {
    const paramsIndex = channelPath.indexOf('/:');
    const hasParams = paramsIndex >= 0;
    let channelToken = channelPath;
    if (hasParams) {
      channelToken = channelPath.slice(0, paramsIndex);
      this.paramsKey.set(channelToken, channelPath.slice(paramsIndex + 2));
    }
    if (!this.handlerMap.has(channelToken)) {
      this.handlerMap.set(channelToken, []);
    }
    const handlerArr = this.handlerMap.get(channelToken) as IPathHandler[];
    const handlerFn = handler.handler.bind(handler);
    const setHandler = (channel: WSChannel, clientId: string, params: any) => {
      handler.connection = channel;
      handlerFn(channel, clientId, params);
    };
    handler.handler = setHandler;
    handlerArr.push(handler);
    this.handlerMap.set(channelToken, handlerArr);
  }
  getParams(channelPath: string, value: string): Record<string, string> {
    const params = {} as Record<string, string>;
    if (this.paramsKey.has(channelPath)) {
      const key = this.paramsKey.get(channelPath);
      if (key) {
        params[key] = value;
      }
    }
    return params;
  }
  removeHandler(channelPath: string, handler: IPathHandler) {
    const paramsIndex = channelPath.indexOf(':');
    const hasParams = paramsIndex >= 0;
    let channelToken = channelPath;
    if (hasParams) {
      channelToken = channelPath.slice(0, paramsIndex);
    }
    const handlerArr = this.handlerMap.get(channelToken) || [];
    const removeIndex = handlerArr.indexOf(handler);
    if (removeIndex !== -1) {
      handlerArr.splice(removeIndex, 1);
    }
    this.handlerMap.set(channelPath, handlerArr);
  }
  get(channelPath: string) {
    return this.handlerMap.get(channelPath);
  }
  disposeConnectionClientId(channel: any, clientId: string) {
    this.handlerMap.forEach((handlerArr: IPathHandler[]) => {
      handlerArr.forEach((handler: IPathHandler) => {
        handler.dispose(channel, clientId);
      });
    });
  }
  dispatchChannelOpen(path: string, channel: WSChannel, clientId: string) {
    // 根据 path 拿到注册的 handler
    let handlerArr = this.get(path);
    let params: Record<string, string> | undefined;
    // 尝试通过父路径查找处理函数，如server/:id方式注册的handler
    if (!handlerArr) {
      const slashIndex = path.indexOf('/');
      const hasSlash = slashIndex >= 0;
      if (hasSlash) {
        handlerArr = this.get(path.slice(0, slashIndex));
        params = this.getParams(path.slice(0, slashIndex), path.slice(slashIndex + 1));
      }
    }

    if (handlerArr) {
      for (let i = 0, len = handlerArr.length; i < len; i++) {
        const handler = handlerArr[i];
        handler.handler(channel, clientId, params);
      }
    }
  }

  getAll() {
    return Array.from(this.handlerMap.values());
  }
}

export const commonChannelPathHandler = new CommonChannelPathHandler();

export abstract class BaseCommonChannelHandler {
  protected channelMap: Map<string, WSChannel> = new Map();

  heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(public handlerId: string, protected logger: ILogger = console) {}

  abstract doHeartbeat(connection: any): void;

  private heartbeat(connection: any) {
    const timer = global.setTimeout(() => {
      this.doHeartbeat(connection);
      this.heartbeat(connection);
    }, 5000);

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    this.heartbeatTimer = timer;
  }

  receiveConnection(connection: IConnectionShape<Uint8Array>) {
    let clientId: string;
    this.heartbeat(connection);

    connection.onMessage((data: Uint8Array) => {
      let msg: ChannelMessage;
      try {
        msg = parse(data);

        switch (msg.kind) {
          case 'ping':
            connection.send(pongMessage);
            break;
          case 'open': {
            const { id, path } = msg;
            clientId = msg.clientId;
            this.logger.log(`open a new connection channel ${clientId} with path ${path}`);

            const channel = new WSServerChannel(connection, { id, logger: this.logger });
            this.channelMap.set(id, channel);

            commonChannelPathHandler.dispatchChannelOpen(path, channel, clientId);
            channel.serverReady();
            break;
          }
          default: {
            const { id } = msg;
            const channel = this.channelMap.get(id);
            if (channel) {
              channel.dispatch(msg);
            } else {
              this.logger.warn(`channel ${id} is not found`);
            }
          }
        }
      } catch (e) {
        this.logger.error('handle connection message error', e);
      }
    });

    connection.onceClose(() => {
      commonChannelPathHandler.disposeConnectionClientId(connection, clientId);

      Array.from(this.channelMap.values())
        .filter((channel) => channel.id.toString().indexOf(clientId) !== -1)
        .forEach((channel) => {
          channel.close(1, 'close');
          channel.dispose();
          this.channelMap.delete(channel.id);
          this.logger.log(`Remove connection channel ${channel.id}`);
        });
    });
  }

  dispose() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
  }
}

export const RPCServiceChannelPath = 'RPCService';
