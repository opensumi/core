import type net from 'net';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder, prependLengthField } from './frame-decoder';

export class NetSocketConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();

  constructor(private socket: net.Socket) {
    super();
    this.socket.on('data', (chunk) => {
      this.decoder.push(chunk);
    });
    this.socket.once('close', () => {
      this.decoder.dispose();
    });
  }

  isOpen(): boolean {
    return this.socket.readyState === 'open';
  }

  send(data: Uint8Array): void {
    this.socket.write(prependLengthField(data));
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    return this.decoder.onData(cb);
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
  dispose(): void {
    this.decoder.dispose();
  }
}
