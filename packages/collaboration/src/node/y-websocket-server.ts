import http from 'http';

import ws from 'ws';
import utils from 'y-websocket/bin/utils';
import * as Y from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import { IYWebsocketServer } from '../common';

@Injectable()
export class YWebsocketServerImpl implements IYWebsocketServer {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  private websocketServer: ws.Server;

  private server: http.Server;

  initialize() {
    this.logger.debug('init y-websocket server');

    this.server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('hello');
    });

    const { setupWSConnection } = utils; // todo add typing?

    this.websocketServer = new ws.Server({ noServer: true });

    this.websocketServer.on('connection', setupWSConnection);

    this.server.on('upgrade', (req, socket, head) => {
      const handleAuth = (ws) => {
        this.websocketServer.emit('connection', ws, req);
      };
      this.websocketServer.handleUpgrade(req, socket, head, handleAuth);
    });

    this.server.listen(12345, () => {
      this.logger.log('y-websocket server listening on port 12345');
    });
  }

  dispose() {
    this.websocketServer.close();
    this.server.close();
  }

  getYDoc(room: string): Y.Doc {
    const { getYDoc } = utils;
    return getYDoc(room);
  }
}
