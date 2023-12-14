import type WebSocket from 'ws';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class WebSocketConnection extends BaseConnection<Uint8Array> {
  constructor(private socket: WebSocket) {
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
  onClose(cb: () => void): IDisposable {
    this.socket.on('close', cb);
    return {
      dispose: () => {
        this.socket.off('close', cb);
      },
    };
  }
}
