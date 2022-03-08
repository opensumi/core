import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/browser/main';

export function createSocketConnection(socket: Worker) {
  return createMessageConnection(new BrowserMessageReader(socket), new BrowserMessageWriter(socket));
}
