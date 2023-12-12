import type WebSocket from 'ws';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseDriver } from './base';

export class WebSocketDriver extends BaseDriver {
  constructor(private socket: WebSocket) {
    super();
  }
  send(data: Uint8Array): void {
    this.socket.send(data);
  }

  onmessage(cb: (data: Uint8Array) => void): IDisposable {
    this.socket.on('message', cb);
    return {
      dispose: () => {
        this.socket.off('message', cb);
      },
    };
  }
}
