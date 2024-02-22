import { MatchFunction, match } from 'path-to-regexp';
import WebSocket from 'ws';

import { ILogger } from '../common';
import { WSWebSocketConnection } from '../common/connection';
import { BaseCommonChannelHandler, commonChannelPathHandler } from '../common/server-handler';

import { CommonChannelHandlerOptions, WebSocketHandler } from './ws';

export { commonChannelPathHandler };

/**
 * Channel Handler for nodejs
 */
export class CommonChannelHandler extends BaseCommonChannelHandler implements WebSocketHandler {
  private wsServer: WebSocket.Server;
  protected handlerRoute: MatchFunction;

  constructor(routePath: string, logger: ILogger = console, private options: CommonChannelHandlerOptions = {}) {
    super('node-channel-handler', logger);
    this.handlerRoute = match(routePath, options.pathMatchOptions);
    this.initWSServer();
  }

  doHeartbeat(connectionId: string, connection: WSWebSocketConnection): void {
    connection.socket.ping();
  }

  private initWSServer() {
    this.logger.log('init Common Channel Handler');
    this.wsServer = new WebSocket.Server({
      noServer: true,
      ...this.options.wsServerOptions,
    });
    this.wsServer.on('connection', (connection: WebSocket) => {
      const wsConnection = new WSWebSocketConnection(connection);
      this.receiveConnection(wsConnection);
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
