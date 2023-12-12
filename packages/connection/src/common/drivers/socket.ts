import type net from 'net';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseDriver } from './base';

export class NetSocketDriver extends BaseDriver {
  constructor(private socket: net.Socket) {
    super();
  }
  send(data: Uint8Array): void {
    this.socket.write(data);
  }

  onmessage(cb: (data: Uint8Array) => void): IDisposable {
    this.socket.on('data', cb);
    return {
      dispose: () => {
        this.socket.off('data', cb);
      },
    };
  }
}
