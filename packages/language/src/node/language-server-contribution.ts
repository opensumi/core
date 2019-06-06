import * as server from 'vscode-ws-jsonrpc/lib/server';
import * as rpc from 'vscode-ws-jsonrpc';

export interface LanguageContribution {
  id: string;
  name: string;

  start(socket: rpc.IWebSocket): void;
}

export abstract class LanguageServerContribution implements LanguageContribution {
  abstract id: string;
  abstract name: string;

  protected createSocketConnection(socket: rpc.IWebSocket, onDispose: () => void) {
    const reader = new rpc.WebSocketMessageReader(socket);
    const writer = new rpc.WebSocketMessageWriter(socket);
    const socketConnection = server.createConnection(reader, writer, onDispose);
    return socketConnection;
  }

  protected createProcessConnection(command, args?, options?) {
    const languageConnection = server.createServerProcess(this.name, command, args, options);
    return languageConnection;
  }

  protected forward(clientConnection: server.IConnection, serverConnection: server.IConnection, map?: (message: rpc.Message) => rpc.Message) {
    server.forward(clientConnection, serverConnection, map);
  }

  abstract start(socket: rpc.IWebSocket): void;

}
