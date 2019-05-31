import * as rpc from 'vscode-ws-jsonrpc';
import * as server from 'vscode-ws-jsonrpc/lib/server';
import * as lsp from 'vscode-languageserver';

/**
 * 通过子进程启动语言服务器
 */
export function launchExt(socket: rpc.IWebSocket) {
  const reader = new rpc.WebSocketMessageReader(socket);
  const writer = new rpc.WebSocketMessageWriter(socket);
  const socketConnection = server.createConnection(reader, writer, () => socket.dispose());

  const tsserverPath = require.resolve('typescript/lib/tsserver');
  // NOTE  使用node子进程启动
  const serverConnection = server.createServerProcess('TypeScript', 'typescript-language-server', ['--stdio', `--tsserver-path=${tsserverPath}`]);
  // NOTE forward：监听reader，写到目标的writer
  server.forward(socketConnection, serverConnection, (message) => {
    if (rpc.isRequestMessage(message)) {
      if (message.method === lsp.InitializeRequest.type.method) {
          const initializeParams = message.params as lsp.InitializeParams;
          initializeParams.processId = process.pid;
      }
    }
    return message;
  });
}
