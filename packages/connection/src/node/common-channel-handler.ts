import { MatchFunction, match } from 'path-to-regexp';
import WebSocket from 'ws';

import { ILogger } from '../common';
import { WSWebSocketConnection } from '../common/connection';
import { BaseCommonChannelHandler, CommonChannelPathHandler } from '../common/server-handler';

import { CommonChannelHandlerOptions, WebSocketHandler } from './ws';

export interface WebSocketConnection extends WebSocket {
  routeParam: {
    pathname: string;
  };
}

/**
 * Channel Handler for nodejs
 */
export class CommonChannelHandler extends BaseCommonChannelHandler implements WebSocketHandler {
  private wsServer: WebSocket.Server;
  protected handlerRoute: MatchFunction;

  constructor(
    routePath: string,
    protected commonChannelPathHandler: CommonChannelPathHandler,
    logger: ILogger = console,
    private options: CommonChannelHandlerOptions = {},
  ) {
    super('node-channel-handler', commonChannelPathHandler, logger);
    this.handlerRoute = match(routePath, options.pathMatchOptions);
    this.initWSServer();
  }

  doHeartbeat(connection: WSWebSocketConnection): void {
    connection.socket.ping();
  }

  private initWSServer() {
    this.logger.log('init common channel handler');
    this.wsServer = new WebSocket.Server({
      noServer: true,
      ...this.options.wsServerOptions,
    });
    this.wsServer.on('connection', (connection: WebSocket) => {
      this.receiveConnection(new WSWebSocketConnection(connection));
    });
  }

  public handleUpgrade(pathname: string, request: any, socket: any, head: any): boolean {
    const routeResult = this.handlerRoute(pathname);

    if (routeResult) {
      this.wsServer.handleUpgrade(request, socket, head, (connection) => {
        (connection as WebSocketConnection).routeParam = {
          pathname,
        };

        this.wsServer.emit('connection', connection);
      });
      return true;
    }

    return false;
  }
}
