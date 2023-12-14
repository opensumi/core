import type net from 'net';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class NetSocketConnection extends BaseConnection<Uint8Array> {
  constructor(private socket: net.Socket) {
    super();
  }
  send(data: Uint8Array): void {
    this.socket.write(data);
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    this.socket.on('data', cb);
    return {
      dispose: () => {
        this.socket.off('data', cb);
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
