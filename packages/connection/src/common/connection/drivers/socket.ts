import { IDisposable } from '@opensumi/ide-core-common';

import { IRuntimeSocketConnection } from './base';
import { StreamConnection } from './stream';

import type net from 'net';

export class NetSocketConnection extends StreamConnection implements IRuntimeSocketConnection {
  constructor(private socket: net.Socket) {
    super(socket, socket);
  }

  isOpen(): boolean {
    return this.socket.readyState === 'open';
  }

  onOpen(cb: () => void): IDisposable {
    this.socket.on('connect', cb);
    return {
      dispose: () => {
        this.socket.off('connect', cb);
      },
    };
  }

  destroy(): void {
    this.socket.destroy();
  }
}
