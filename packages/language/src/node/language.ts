import * as http from 'http';
import * as net from 'net';
import * as ws from 'ws';
import * as rpc from 'vscode-ws-jsonrpc';
import {launchExt} from './ls-launcher';

export function handleMonacoUpgrade(request: http.IncomingMessage, socket: net.Socket, head: Buffer, webSocketServer: ws.Server) {
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    const lsSocket: rpc.IWebSocket = {
      send: (content) => {
          webSocket.send(content, (error) => {
              if (error) {
                  console.error(error);
              }
          });
      },
      onMessage: (cb) => webSocket.on('message', cb),
      onClose: (cb) => webSocket.on('close', cb),
      onError: (cb) => webSocket.on('error', cb),
      dispose: () => webSocket.close(),
    };
    if (webSocket.readyState === webSocket.OPEN) {
        launchExt(lsSocket);
    } else {
        webSocket.on('open', () => launchExt(lsSocket));
    }
  });
}
