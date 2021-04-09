import {
  createBrowserMessageConnection,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from '@ali/vscode-jsonrpc';

export { WebSocketMessageReader, WebSocketMessageWriter };

export function createWebSocketConnection(socket: any) {
  return createBrowserMessageConnection(
    new WebSocketMessageReader(socket),
    new WebSocketMessageWriter(socket),
  );
}
