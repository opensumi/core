import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder, createByteLength, indicator } from './frame-decoder';

import type net from 'net';

export class NetSocketConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();

  constructor(private socket: net.Socket) {
    super();
    const decode = (chunk) => {
      this.decoder.push(chunk);
    };
    this.socket.on('data', decode);
    this.socket.once('close', () => {
      this.decoder.dispose();
      this.socket.off('data', decode);
    });
  }

  isOpen(): boolean {
    return this.socket.readyState === 'open';
  }

  send(data: Uint8Array): void {
    this.socket.write(indicator);
    this.socket.write(createByteLength(data.byteLength));
    this.socket.write(data);
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    return this.decoder.onData(cb);
  }

  onceClose(cb: (code?: number, reason?: string) => void): IDisposable {
    const wrapper = (hadError: boolean) => {
      const code: number = hadError ? 1 : 0;
      const reason: string = hadError ? 'had error' : '';
      cb(code, reason);
    };

    this.socket.once('close', wrapper);
    return {
      dispose: () => {
        this.socket.off('close', wrapper);
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

  destroy(): void {
    this.socket.destroy();
  }
}
