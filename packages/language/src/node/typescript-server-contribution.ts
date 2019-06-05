import * as rpc from 'vscode-ws-jsonrpc';
import { LanguageServerContribution } from './language-server-contribution';
import { TYPESCRIPT_LANGUAGE_ID, TYPESCRIPT_LANGUAGE_NAME } from '../common';

export class TypeScriptServerContribution extends LanguageServerContribution {
  id = TYPESCRIPT_LANGUAGE_ID;
  name = TYPESCRIPT_LANGUAGE_NAME;

  start(socket: rpc.IWebSocket) {
    const clientConnection = this.createSocketConnection(socket, () => console.log('ts server dispose'));
    const tsserverPath = require.resolve('typescript/lib/tsserver');
    const serverConnection = this.createProcessConnection('typescript-language-server', ['--stdio', `--tsserver-path=${tsserverPath}`]);
    console.log('server started');
    this.forward(clientConnection, serverConnection);
  }
}
