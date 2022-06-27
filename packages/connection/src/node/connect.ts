import type net from 'net';

import {
  SocketMessageReader,
  SocketMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/node/main';

export function createSocketConnection(socket: net.Socket) {
  // return createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));

  const messageConnection = createMessageConnection(new SocketMessageReader(socket), new SocketMessageWriter(socket));

  const messageConnectionProxy = new Proxy(messageConnection, {
    get(target, prop) {
      if (prop === 'sendRequest' || prop === 'sendNotification') {
        return function (...args: any) {
          // 注意这是common/xxx，所以要同时考虑在browser和在node的情况，node是没有window的
          if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__) {
            window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__.traffic.send([prop, ...args]);
          }
          return target[prop].apply(target, [...args]);
        };
      }

      if (prop === 'onRequest' || prop === 'onNotification') {
        return function (...args: any) {
          if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__) {
            window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__.traffic.receive([prop, ...args]);
          }
          return target[prop].apply(target, [...args]);
        };
      }
      return target[prop];
    },
  });

  return messageConnectionProxy;
}
