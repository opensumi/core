import type net from 'net';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class NetSocketConnection extends BaseConnection<Uint8Array> {
  constructor(private socket: net.Socket) {
    super();
  }
  send(data: Uint8Array | string): void {
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

  onceClose(cb: () => void): IDisposable {
    this.socket.once('close', cb);
    return {
      dispose: () => {
        this.socket.off('close', cb);
      },
    };
  }

  onOpen(cb: () => void): IDisposable {
    this.socket.on('connect', cb);
    return {
      dispose: () => {
        this.socket.off('connect', cb);
      },
    };
  }

  onError(cb: (err: Error) => void): IDisposable {
    this.socket.on('error', cb);
    return {
      dispose: () => {
        this.socket.off('error', cb);
      },
    };
  }
}
