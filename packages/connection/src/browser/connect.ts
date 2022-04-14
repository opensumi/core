import type net from 'net';

import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

/**
 * 由于 `@opensumi/vscode-jsonrpc/lib/browser/main` 下对于 RAL（runtime abstraction layer）
 * 的消息传递时会忽略 `options.charset !== 'utf-8'` 的消息，故导致 WS 等消息收发异常
 * 该逻辑受加载时序影响，原有的逻辑会导致在 `packages/core-browser/src/bootstrap/connection.ts` 执行的情况下
 * 导致首次消息收发异常
 */
export function createSocketConnection(socket: net.Socket) {
  return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));
}
