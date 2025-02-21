/* eslint-disable no-console */
import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder } from './frame-decoder';

import type { Readable, Writable } from 'stream';

export class StreamConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();

  constructor(public readable: Readable, public writable: Writable) {
    super();
    const decode = (chunk: Uint8Array) => {
      this.decoder.push(chunk);
    };
    this.readable.on('data', decode);
    this.readable.once('close', () => {
      this.decoder.dispose();
      this.readable.off('data', decode);
    });
  }

  send(data: Uint8Array): void {
    const handle = LengthFieldBasedFrameDecoder.construct(data).dumpAndOwn();
    try {
      this.writable.write(handle.get(), (error) => {
        if (error) {
          console.error('Failed to write data:', error);
        }
      });
    } finally {
      handle.dispose();
    }
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    return this.decoder.onData(cb);
  }

  onceClose(cb: (code?: number, reason?: string) => void): IDisposable {
    const disposable = this.onClose(wrapper);
    return {
      dispose: () => {
        disposable.dispose();
      },
    };

    function wrapper(code: number, reason: string) {
      cb(code, reason);
      disposable.dispose();
    }
  }

  onClose(cb: (code?: number, reason?: string) => void): IDisposable {
    const wrapper = (hadError: boolean) => {
      const code: number = hadError ? 1 : 0;
      const reason: string = hadError ? 'had error' : '';
      cb(code, reason);
    };

    this.readable.on('close', wrapper);
    if ((this.writable as any) !== (this.readable as any)) {
      this.writable.on('close', wrapper);
    }

    return {
      dispose: () => {
        this.readable.off('close', wrapper);
        if ((this.writable as any) !== (this.readable as any)) {
          this.writable.off('close', wrapper);
        }
      },
    };
  }

  onError(cb: (err: Error) => void): IDisposable {
    this.readable.on('error', cb);
    if ((this.writable as any) !== (this.readable as any)) {
      this.writable.on('error', cb);
    }
    return {
      dispose: () => {
        this.readable.off('error', cb);
        if ((this.writable as any) !== (this.readable as any)) {
          this.writable.off('error', cb);
        }
      },
    };
  }
  dispose(): void {
    this.decoder.dispose();
  }
}
