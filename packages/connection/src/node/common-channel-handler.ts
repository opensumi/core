import { MatchFunction, match } from 'path-to-regexp';
import WebSocket from 'ws';

import { IDisposable } from '@opensumi/ide-core-common';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { SocketChannel, ChannelMessage, parse, stringify } from '../common/socket-channel';
import { IBinaryConnectionSocket } from '../common/sumi-rpc/types';
import { ILogger } from '../common/types';

import { WebSocketHandler, CommonChannelHandlerOptions } from './ws';

export interface IPathHandler {
  dispose: (connection: any, connectionId: string) => void;
  handler: (connection: any, connectionId: string, params?: any) => void;
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
    const setHandler = (connection: SocketChannel, clientId: string, params) => {
      handler.connection = connection;
      handlerFn(connection, clientId, params);
    };
    handler.handler = setHandler;
    handlerArr.push(handler);
    this.handlerMap.set(channelToken, handlerArr);
  }
  getParams(channelPath: string, value: string) {
    const params = {};
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

// 后台 Web 链接处理类
export class CommonChannelHandler extends WebSocketHandler {
  static channelId = 0;

  public handlerId = 'common-channel';
  private wsServer: WebSocket.Server;
  protected handlerRoute: MatchFunction;
  private channelMap: Map<string, SocketChannel> = new Map();
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
    this.wsServer.on('connection', (connection) => {
      let connectionId: string;
      connection.on('message', (data: PlatformBuffer) => {
        let msgObj: ChannelMessage;
        try {
          msgObj = parse(data);

          if (msgObj.kind === 'heartbeat') {
            connection.send(
              stringify({
                kind: 'heartbeat',
                clientId: msgObj.clientId,
              }),
            );
          } else if (msgObj.kind === 'client') {
            const clientId = msgObj.clientId;
            this.logger.log(`New connection with id ${clientId}`);
            connectionId = clientId;
            this.connectionMap.set(clientId, connection);
            this.heartbeat(connectionId, connection);
            // channel 消息处理
          } else if (msgObj.kind === 'open') {
            const channelId = msgObj.id; // CommonChannelHandler.channelId ++;
            const { path } = msgObj;
            this.logger.log(`Open a new connection channel ${channelId} with path ${path}`);

            // 生成 channel 对象
            const connectionSend = this.channelConnectionSend(connection);
            const channel = new SocketChannel(connectionSend, channelId);
            this.channelMap.set(channelId, channel);

            // 根据 path 拿到注册的 handler
            let handlerArr = commonChannelPathHandler.get(path);
            let params;
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
          this.logger.warn(e);
        }
      });

      connection.on('close', () => {
        commonChannelPathHandler.disposeConnectionClientId(connection, connectionId as string);

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

  private channelConnectionSend = (connection: WebSocket) => (content: string | PlatformBuffer) => {
    if (connection.readyState === connection.OPEN) {
      connection.send(content, (err: any) => {
        if (err) {
          this.logger.log(err);
        }
      });
    }
  };
  public handleUpgrade(pathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(pathname);

    if (routeResult) {
      const wsServer = this.wsServer;
      wsServer.handleUpgrade(request, socket, head, (connection: WebSocket) => {
        (connection as any).routeParam = {
          pathname,
        };

        wsServer.emit('connection', connection);
      });
      return true;
    }

    return false;
  }
}

export interface ICommonHandlerSocket {
  send(data: PlatformBuffer): void;
  onmessage: (cb: (data: PlatformBuffer) => void) => IDisposable | void;
}

export type ICommonHandlerConnectionSend = (content: PlatformBuffer) => void;

export class CommonChannelHandler4Electron {
  channelMap = new Map<string, SocketChannel>();

  constructor(public name: string, private logger: ILogger) {}

  getOrCreateChannel(clientId: string, connectionSend?: ICommonHandlerConnectionSend) {
    let channel = this.channelMap.get(clientId);
    if (!channel && connectionSend) {
      channel = new SocketChannel(connectionSend, clientId);
      this.channelMap.set(clientId, channel);
    }
    return channel;
  }

  handleSocket(
    socket: IBinaryConnectionSocket,
    options: {
      onSocketChannel(channel: SocketChannel): void;
    },
  ) {
    socket.onmessage((data) => {
      let msgObj: ChannelMessage;

      try {
        msgObj = parse(data);
        if (msgObj.kind === 'open') {
          const channel = this.getOrCreateChannel(msgObj.id, (content) => {
            socket.send(content);
          })!;
          options.onSocketChannel(channel);
        } else if (msgObj.kind === 'data' || msgObj.kind === 'binary') {
          const channel = this.getOrCreateChannel(msgObj.id);
          if (!channel) {
            this.logger.error(`channel ${msgObj.id} not found`);
            return;
          }

          channel.handleMessage(msgObj);
        }
      } catch (error) {}
    });
  }
}
