import type { Readable, Writable } from 'stream';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { StreamPacketDecoder, createStreamPacket } from './stream-decoder';

export class StreamConnection extends BaseConnection<Uint8Array> {
  protected decoder = new StreamPacketDecoder();

  constructor(protected _readable: Readable, protected _writable: Writable) {
    super();
    this._readable.on('data', (chunk) => {
      this.decoder.push(chunk);
    });
    this._readable.once('close', () => {
      this.decoder.dispose();
    });
  }

  isOpen(): boolean {
    return this._readable.readable && this._writable.writable;
  }

  send(data: Uint8Array): void {
    this._writable.write(createStreamPacket(data));
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    const dispose = this.decoder.onData(cb);
    return {
      dispose,
    };
  }

  onceClose(cb: () => void): IDisposable {
    this._readable.once('close', cb);
    this._writable.once('close', cb);
    return {
      dispose: () => {
        this._readable.off('close', cb);
        this._writable.off('close', cb);
      },
    };
  }

  onError(cb: (err: Error) => void): IDisposable {
    this._readable.on('error', cb);
    this._writable.on('error', cb);
    return {
      dispose: () => {
        this._readable.off('error', cb);
        this._writable.off('error', cb);
      },
    };
  }
}
