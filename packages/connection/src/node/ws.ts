import http from 'http';
import url from 'url';

import ws from 'ws';

export abstract class WebSocketHandler {
  abstract handlerId: string;
  abstract handleUpgrade(wsPathname: string, request: any, socket: any, head: any): boolean;
  init?(): void;
}

export interface CommonChannelHandlerOptions {
  wsServerOptions?: ws.ServerOptions;
  pathMatchOptions?: {
    // When true the regexp will match to the end of the string.
    end?: boolean;
  };
}

export class WebSocketServerRoute {
  public server: http.Server;
  public port?: number;
  private wsServerHandlerArr: WebSocketHandler[];

  constructor(
    server: http.Server,
    private logger: any = console,
    port = 8729,
    wsServerHandlerArr: WebSocketHandler[] = [],
  ) {
    if (server) {
      this.server = server as http.Server;
    }

    this.port = port;
    this.wsServerHandlerArr = wsServerHandlerArr;
  }

  public registerHandler(handler: WebSocketHandler) {
    const wsServerHandlerArr = this.wsServerHandlerArr;
    const findHandler = (h: WebSocketHandler) => h.handlerId === handler!.handlerId;

    if (wsServerHandlerArr.findIndex(findHandler) === -1) {
      this.wsServerHandlerArr.push(handler);
    }
  }

  public deleteHandler(handler: WebSocketHandler | string) {
    let handlerId: string;
    if ((handler as WebSocketHandler).handlerId) {
      handlerId = (handler as WebSocketHandler).handlerId;
    } else {
      handlerId = handler as string;
    }

    const handlerIndex = this.wsServerHandlerArr.findIndex((handler) => handler.handlerId === handlerId);

    if (handlerIndex !== -1) {
      this.wsServerHandlerArr.splice(handlerIndex, 1);
      return true;
    } else {
      return false;
    }
  }

  public init() {
    this.initServer();
    this.initHandler();
    this.handleUpgrade();
  }
  private initServer() {
    if (!this.server) {
      this.server = http.createServer();
      this.server.listen(this.port, () => {
        this.logger.log(`websocket server listen on ${this.port}`);
      });
    }
  }
  private initHandler() {
    this.wsServerHandlerArr.forEach((handler) => {
      if (handler.init) {
        handler.init.call(handler);
      }
    });
  }
  private handleUpgrade() {
    const server = this.server;
    const wsServerHandlerArr = this.wsServerHandlerArr;

    server.on('upgrade', (request, socket, head) => {
      const wsPathname: string = url.parse(request.url).pathname as string;

      let wsHandlerIndex = 0;
      const wsHandlerLength = wsServerHandlerArr.length;

      for (; wsHandlerIndex < wsHandlerLength; wsHandlerIndex++) {
        const handler = wsServerHandlerArr[wsHandlerIndex];
        const handleResult = handler.handleUpgrade(wsPathname, request, socket, head);
        if (handleResult) {
          break;
        }
      }

      if (wsHandlerIndex === wsHandlerLength) {
        this.logger.error(`request.url ${request.url} mismatch!`);
      }
    });
  }
}
