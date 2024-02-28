import { StreamConnection } from './stream';

import type net from 'net';

export class NetSocketConnection extends StreamConnection {
  constructor(private socket: net.Socket) {
    super(socket, socket);
  }

  isOpen(): boolean {
    return this.socket.readyState === 'open';
  }

  destroy(): void {
    this.socket.destroy();
  }
}
