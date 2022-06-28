import {
  AbstractMessageReader,
  AbstractMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/common/api';
import { Disposable } from '@opensumi/vscode-jsonrpc/lib/common/disposable';
import { MessageReader, DataCallback } from '@opensumi/vscode-jsonrpc/lib/common/messageReader';
import { MessageWriter } from '@opensumi/vscode-jsonrpc/lib/common/messageWriter';
/**
 * FIXME: 由于 `createMessageConnection` 方法隐式依赖了 `@opensumi/vscode-jsonrpc/lib/browser/main` 或 `@opensumi/vscode-jsonrpc/lib/node/main`
 * 的 `RIL.install()` 初始化代码，而 `browser/main` 中仅支持浏览器使用，
 * 故需要保证提前引入或执行一次 `@opensumi/vscode-jsonrpc/lib/node/main` 代码才能保证逻辑正常执行
 */
import '@opensumi/vscode-jsonrpc/lib/node/main';

export class WebSocketMessageReader extends AbstractMessageReader implements MessageReader {
  protected state: 'initial' | 'listening' | 'closed' = 'initial';
  protected callback: DataCallback | undefined;
  protected events: { message?: any; error?: any }[] = [];

  constructor(protected readonly socket) {
    super();
    if (this.socket.onMessage) {
      this.socket.onMessage((message) => {
        this.readMessage(message);
      });
    } else if (this.socket.onmessage) {
      this.socket.onmessage = (message) => {
        this.readMessage(message);
      };
    } else if (this.socket.on) {
      this.socket.on('message', (message) => {
        this.readMessage(message);
      });
    }
  }

  public listen(callback: DataCallback): Disposable {
    if (this.state === 'initial') {
      this.state = 'listening';
      this.callback = callback;
    }

    while (this.events.length !== 0) {
      const event = this.events.pop()!;
      if (event.message) {
        this.readMessage(event.message);
      }
    }

    return Disposable.create(() => {
      this.state = 'closed';
      this.callback = undefined;
      this.events = [];
    });
  }

  protected readMessage(message) {
    if (this.state === 'initial') {
      this.events.splice(0, 0, { message });
    } else if (this.state === 'listening') {
      const data = JSON.parse(message);
      this.callback!(data);
    }
  }
}

export class WebSocketMessageWriter extends AbstractMessageWriter implements MessageWriter {
  constructor(protected readonly socket) {
    super();
  }

  write(msg): Promise<void> {
    try {
      const content = JSON.stringify(msg);
      this.socket.send(content);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public end(): void {}
}

declare global {
  interface Window {
    __OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__: any;
  }
}

/**
 * 给服务端的 WebSocket 及 Browser 端的 WebSocket 实例共用的方法
 * @param socket
 * @returns
 */
export function createWebSocketConnection(socket: any) {
  // return createMessageConnection(new WebSocketMessageReader(socket), new WebSocketMessageWriter(socket));

  const messageConnection = createMessageConnection(
    new WebSocketMessageReader(socket),
    new WebSocketMessageWriter(socket),
  );

  // sendRequest是有回复的，在proxy.ts中处理requestResult
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

      // onNotification很多的，onRequest我都试不出来
      // if (prop === 'onRequest' || prop === 'onNotification') {
      //   return function (...args: any) {
      //     if (typeof window !== 'undefined' && window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__) {
      //       window.__OPENSUMI_DEVTOOL_EVENT_SOURCE_TOKEN__.traffic.receive([prop, ...args]);
      //     }
      //     return target[prop].apply(target, [...args]);
      //   };
      // }
      return target[prop];
    },
  });

  return messageConnectionProxy;
}
