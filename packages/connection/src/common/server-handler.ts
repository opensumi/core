import { IConnectionShape } from './connection/types';
import { ILogger } from './types';
import { ChannelMessage, WSChannel, parse, stringify } from './ws-channel';

export interface IPathHandler {
  dispose: (connection: any, connectionId: string) => void;
  handler: (connection: any, connectionId: string, params?: Record<string, string>) => void;
  reconnect?: (connection: any, connectionId: string) => void;
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
  disposeConnectionClientId(connection: any, clientId: string) {
    this.handlerMap.forEach((handlerArr: IPathHandler[]) => {
      handlerArr.forEach((handler: IPathHandler) => {
        handler.dispose(connection, clientId);
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
  protected heartbeatMap: Map<string, NodeJS.Timeout> = new Map();

  constructor(public handlerId: string, protected logger: ILogger = console) {}

  abstract doHeartbeat(connectionId: string, connection: any): void;

  private heartbeat(connectionId: string, connection: any) {
    const timer = global.setTimeout(() => {
      this.doHeartbeat(connectionId, connection);
      this.heartbeat(connectionId, connection);
    }, 5000);

    this.heartbeatMap.set(connectionId, timer);
  }

  receiveConnection(connection: IConnectionShape<Uint8Array>) {
    connection.onMessage((msg: Uint8Array) => {
      let msgObj: ChannelMessage;
      try {
        msgObj = parse(msg);

        if (msgObj.kind === 'ping') {
          connection.send(
            stringify({
              kind: 'pong',
              id: msgObj.id,
              clientId,
            }),
          );
        } else if (msgObj.kind === 'open') {
          const { id, path } = msgObj;
          clientId = msgObj.clientId;
          this.logger.log(`open a new connection channel ${clientId} with path ${path}`);

          this.heartbeat(id, connection);

          const channel = new WSChannel(connection, { id });
          this.channelMap.set(id, channel);

          commonChannelPathHandler.dispatchChannelOpen(path, channel, clientId);
          channel.serverReady();
        } else {
          const { id } = msgObj;
          const channel = this.channelMap.get(id);
          if (channel) {
            channel.dispatchChannelMessage(msgObj);
          } else {
            this.logger.warn(`The channel(${id}) was not found`);
          }
        }
      } catch (e) {
        this.logger.error('handle connection message error', e);
      }
    });

    let clientId: string;

    connection.onceClose(() => {
      commonChannelPathHandler.disposeConnectionClientId(connection, clientId);

      if (this.heartbeatMap.has(clientId)) {
        clearTimeout(this.heartbeatMap.get(clientId) as NodeJS.Timeout);
        this.heartbeatMap.delete(clientId);

        this.logger.log(`Clear heartbeat from channel ${clientId}`);
      }

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
}

export const RPCServiceChannelPath = 'RPCService';
