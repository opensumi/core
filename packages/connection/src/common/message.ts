import {
  AbstractMessageReader,
  AbstractMessageWriter,
  createMessageConnection,
} from '@opensumi/vscode-jsonrpc/lib/common/api';
import { Disposable } from '@opensumi/vscode-jsonrpc/lib/common/disposable';
import { MessageReader, DataCallback } from '@opensumi/vscode-jsonrpc/lib/common/messageReader';
import { MessageWriter } from '@opensumi/vscode-jsonrpc/lib/common/messageWriter';

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

/**
 * 给服务端的 WebSocket 及 Browser 端的 WebSocket 实例共用的方法
 * @param socket
 * @returns
 */
export function createWebSocketConnection(socket: any) {
  return createMessageConnection(new WebSocketMessageReader(socket), new WebSocketMessageWriter(socket));
}
