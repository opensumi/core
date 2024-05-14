import ReconnectingWebSocket, {
  Options as ReconnectingWebSocketOptions,
  UrlProvider,
} from '@bytemain/reconnecting-websocket';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

import type { ErrorEvent } from '@bytemain/reconnecting-websocket';

export class ReconnectingWebSocketConnection extends BaseConnection<Uint8Array> {
  constructor(private socket: ReconnectingWebSocket) {
    super();
  }

  send(data: Uint8Array): void {
    this.socket.send(data);
  }

  isOpen(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }

  onOpen(cb: () => void): IDisposable {
    this.socket.addEventListener('open', cb);
    return {
      dispose: () => {
        this.socket.removeEventListener('open', cb);
      },
    };
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    const handler = (e: MessageEvent) => {
      let buffer: Promise<ArrayBuffer>;
      if (e.data instanceof Blob) {
        buffer = e.data.arrayBuffer();
      } else if (e.data instanceof ArrayBuffer) {
        buffer = Promise.resolve(e.data);
      } else if (e.data?.constructor?.name === 'Buffer') {
        // Compatibility with nodejs Buffer in test environment
        buffer = Promise.resolve(e.data);
      } else {
        throw new Error('unknown message type, expect Blob or ArrayBuffer, received: ' + typeof e.data);
      }
      buffer.then((v) => cb(new Uint8Array(v, 0, v.byteLength)));
    };

    this.socket.addEventListener('message', handler);
    return {
      dispose: () => {
        this.socket.removeEventListener('message', handler);
      },
    };
  }
  onceClose(cb: (code?: number, reason?: string) => void): IDisposable {
    const disposable = this.onClose(wrapper);

    return {
      dispose: () => {
        disposable.dispose();
      },
    };
    function wrapper(code: number, reason: string) {
      cb(code, reason);
      disposable.dispose();
    }
  }
  onClose(cb: (code?: number, reason?: string) => void): IDisposable {
    const handler = (e: CloseEvent) => {
      cb(e.code, e.reason);
    };

    this.socket.addEventListener('close', handler);
    return {
      dispose: () => {
        this.socket.removeEventListener('close', handler);
      },
    };
  }
  onError(cb: (e: Error) => void): IDisposable {
    const handler = (e: ErrorEvent) => {
      cb(e.error);
    };

    this.socket.addEventListener('error', handler);
    return {
      dispose: () => {
        this.socket.removeEventListener('error', handler);
      },
    };
  }

  dispose(): void {
    // do nothing
  }

  static forURL(url: UrlProvider, protocols?: string | string[], options?: ReconnectingWebSocketOptions) {
    const rawConnection = new ReconnectingWebSocket(url, protocols, options);
    rawConnection.binaryType = 'arraybuffer';
    return new ReconnectingWebSocketConnection(rawConnection);
  }
}
