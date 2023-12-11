import type net from 'net';

import { IDisposable } from '@opensumi/ide-core-common';

import { IBinaryConnectionSocket } from '../sumi-rpc/types';

export class NetSocketDriver implements IBinaryConnectionSocket {
  constructor(private socket: net.Socket) {}
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
