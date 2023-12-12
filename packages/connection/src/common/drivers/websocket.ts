import type WebSocket from 'ws';

import { IDisposable } from '@opensumi/ide-core-common';

import { IBinaryConnectionSocket } from '../sumi-rpc/types';

export class WebSocketDriver implements IBinaryConnectionSocket {
  constructor(private socket: WebSocket) {}
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
