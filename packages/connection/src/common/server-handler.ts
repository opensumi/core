import { ChannelMessage, ErrorMessageCode } from './channel/types';
import { IConnectionShape } from './connection/types';
import { furySerializer, wrapSerializer } from './serializer';
import { ISerializer } from './serializer/types';
import { ILogger } from './types';
import { WSChannel, WSServerChannel } from './ws-channel';

import type { Injector } from '@opensumi/di';

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
  openChannel(path: string, channel: WSChannel, clientId: string) {
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

export interface ChannelHandlerOptions {
  serializer?: ISerializer<ChannelMessage, any>;
}

enum ServerChannelCloseCode {
  ConnectionClosed = 1,
  NewChannelOpened = 2,
}

export abstract class BaseCommonChannelHandler {
  protected channelMap: Map<string, WSServerChannel> = new Map();

  protected heartbeatTimer: NodeJS.Timeout | null = null;

  serializer: ISerializer<ChannelMessage, any> = furySerializer;
  constructor(
    public handlerId: string,
    protected commonChannelPathHandler: CommonChannelPathHandler,
    protected logger: ILogger = console,
    options: ChannelHandlerOptions = {},
  ) {
    if (options.serializer) {
      this.serializer = options.serializer;
    }
  }

  abstract doHeartbeat(connection: any): void;

  private heartbeat(connection: any) {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }

    this.heartbeatTimer = setTimeout(() => {
      this.doHeartbeat(connection);
      this.heartbeat(connection);
    }, 5000);
  }

  receiveConnection(connection: IConnectionShape<Uint8Array>) {
    let clientId: string;
    this.heartbeat(connection);

    const wrappedConnection = wrapSerializer(connection, this.serializer);

    wrappedConnection.onMessage((msg: ChannelMessage) => {
      try {
        switch (msg.kind) {
          case 'open': {
            const { id, path, traceId } = msg;
            clientId = msg.clientId;

            this.logger.log(`open a new connection channel ${clientId} with path ${path}`);
            let channel = this.channelMap.get(id);
            if (channel) {
              channel.close(ServerChannelCloseCode.NewChannelOpened, 'new channel opened for the same channel id');
              channel.dispose();
            }

            channel = new WSServerChannel(wrappedConnection, { id, clientId, logger: this.logger });
            this.channelMap.set(id, channel);
            this.commonChannelPathHandler.openChannel(path, channel, clientId);
            channel.serverReady(traceId);
            break;
          }
          default: {
            const { id } = msg;

            const channel = this.channelMap.get(id);
            if (channel) {
              channel.dispatch(msg);
            } else {
              wrappedConnection.send({
                kind: 'error',
                id,
                code: ErrorMessageCode.ChannelNotFound,
                message: `channel ${id} not found`,
              });

              this.logger.warn(`channel ${id} is not found`);
            }
          }
        }
      } catch (e) {
        this.logger.error('handle connection message error', e);
      }
    });

    connection.onceClose(() => {
      this.logger.log(`connection ${clientId} is closed, dispose all channels`);
      this.commonChannelPathHandler.disposeConnectionClientId(connection, clientId);

      Array.from(this.channelMap.values())
        .filter((channel) => channel.clientId === clientId)
        .forEach((channel) => {
          channel.close(ServerChannelCloseCode.ConnectionClosed, 'connection closed');
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

export function injectConnectionProviders(injector: Injector) {
  const commonChannelPathHandler = new CommonChannelPathHandler();
  injector.addProviders({
    token: CommonChannelPathHandler,
    useValue: commonChannelPathHandler,
  });
}
