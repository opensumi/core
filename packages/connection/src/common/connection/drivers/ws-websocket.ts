import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

import type WebSocket from 'ws';

export class WSWebSocketConnection extends BaseConnection<Uint8Array> {
  constructor(public socket: WebSocket) {
    super();
  }
  send(data: Uint8Array): void {
    this.socket.send(data);
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    this.socket.on('message', cb);
    return {
      dispose: () => {
        this.socket.off('message', cb);
      },
    };
  }
  onceClose(cb: () => void): IDisposable {
    this.socket.once('close', cb);
    return {
      dispose: () => {
        this.socket.off('close', cb);
      },
    };
  }

  isOpen() {
    return this.socket.readyState === this.socket.OPEN;
  }

  dispose(): void {
    this.socket.removeAllListeners();
  }
}
