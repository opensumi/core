import { MatchFunction, match } from 'path-to-regexp';
import WebSocket from 'ws';

import { WSWebSocketConnection } from '../common/connection';
import { WSChannel, ChannelMessage, stringify, parse } from '../common/ws-channel';

import { WebSocketHandler, CommonChannelHandlerOptions } from './ws';

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
  disposeConnectionClientId(connection: WebSocket, clientId: string) {
    this.handlerMap.forEach((handlerArr: IPathHandler[]) => {
      handlerArr.forEach((handler: IPathHandler) => {
        handler.dispose(connection, clientId);
      });
    });
  }
  getAll() {
    return Array.from(this.handlerMap.values());
  }
}

export const commonChannelPathHandler = new CommonChannelPathHandler();

/**
 * Channel Handler for nodejs
 */
export class CommonChannelHandler extends WebSocketHandler {
  public handlerId = 'common-channel';
  private wsServer: WebSocket.Server;
  protected handlerRoute: MatchFunction;
  private channelMap: Map<string, WSChannel> = new Map();
  private connectionMap: Map<string, WebSocket> = new Map();
  private heartbeatMap: Map<string, NodeJS.Timeout> = new Map();

  constructor(routePath: string, private logger: any = console, private options: CommonChannelHandlerOptions = {}) {
    super();
    this.handlerRoute = match(routePath, options.pathMatchOptions);
    this.initWSServer();
  }

  private heartbeat(connectionId: string, connection: WebSocket) {
    const timer = global.setTimeout(() => {
      connection.ping();
      this.heartbeat(connectionId, connection);
    }, 5000);

    this.heartbeatMap.set(connectionId, timer);
  }

  private initWSServer() {
    this.logger.log('init Common Channel Handler');
    this.wsServer = new WebSocket.Server({
      noServer: true,
      ...this.options.wsServerOptions,
    });
    this.wsServer.on('connection', (connection: WebSocket) => {
      let connectionId: string;
      connection.on('message', (msg: Uint8Array) => {
        let msgObj: ChannelMessage;
        try {
          msgObj = parse(msg);

          if (msgObj.kind === 'heartbeat') {
            connection.send(
              stringify({
                kind: 'heartbeat',
                id: msgObj.id,
              }),
            );
          } else if (msgObj.kind === 'open') {
            connectionId = msgObj.id;
            const { path } = msgObj;
            this.logger.log(`Open a new connection channel ${connectionId} with path ${path}`);
            const wsConnection = new WSWebSocketConnection(connection);
            this.logger.log(`New connection with id ${connectionId}`);
            this.connectionMap.set(connectionId, connection);
            this.heartbeat(connectionId, connection);

            const channel = new WSChannel(wsConnection, { id: connectionId, tag: 'node-ws-server-handler' });
            this.channelMap.set(connectionId, channel);

            // 根据 path 拿到注册的 handler
            let handlerArr = commonChannelPathHandler.get(path);
            let params: Record<string, string> | undefined;
            // 尝试通过父路径查找处理函数，如server/:id方式注册的handler
            if (!handlerArr) {
              const slashIndex = path.indexOf('/');
              const hasSlash = slashIndex >= 0;
              if (hasSlash) {
                handlerArr = commonChannelPathHandler.get(path.slice(0, slashIndex));
                params = commonChannelPathHandler.getParams(path.slice(0, slashIndex), path.slice(slashIndex + 1));
              }
            }

            if (handlerArr) {
              for (let i = 0, len = handlerArr.length; i < len; i++) {
                const handler = handlerArr[i];
                handler.handler(channel, connectionId, params);
              }
            }

            channel.ready();
          } else {
            const { id } = msgObj;
            const channel = this.channelMap.get(id);
            if (channel) {
              channel.handleMessage(msgObj);
            } else {
              this.logger.warn(`The channel(${id}) was not found`);
            }
          }
        } catch (e) {
          this.logger.error('handle connection message error', e);
        }
      });

      connection.on('close', () => {
        commonChannelPathHandler.disposeConnectionClientId(connection, connectionId);

        if (this.heartbeatMap.has(connectionId)) {
          clearTimeout(this.heartbeatMap.get(connectionId) as NodeJS.Timeout);
          this.heartbeatMap.delete(connectionId);

          this.logger.verbose(`Clear heartbeat from channel ${connectionId}`);
        }

        Array.from(this.channelMap.values())
          .filter((channel) => channel.id.toString().indexOf(connectionId) !== -1)
          .forEach((channel) => {
            channel.close(1, 'close');
            this.channelMap.delete(channel.id);
            this.logger.verbose(`Remove connection channel ${channel.id}`);
          });
      });
    });
  }

  public handleUpgrade(pathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(pathname);

    if (routeResult) {
      this.wsServer.handleUpgrade(request, socket, head, (connection) => {
        (connection as any).routeParam = {
          pathname,
        };

        this.wsServer.emit('connection', connection);
      });
      return true;
    }

    return false;
  }
}
