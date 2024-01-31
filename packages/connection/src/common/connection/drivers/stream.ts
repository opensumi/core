import type stream from 'stream';

import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';
import { StreamPacketDecoder, createStreamPacket } from './stream-decoder';

export class StreamConnection extends BaseConnection<Uint8Array> {
  protected decoder = new StreamPacketDecoder();

  constructor(protected output: stream.Readable, protected input: stream.Writable) {
    super();
    output.on('data', (chunk) => {
      this.decoder.push(chunk);
    });
    output.once('close', () => {
      this.decoder.dispose();
    });
  }
  get writable(): boolean {
    return this.input.writable;
  }

  send(data: Uint8Array): void {
    this.input.write(createStreamPacket(data));
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    const dispose = this.decoder.onData(cb);
    return {
      dispose,
    };
  }

  /**
   * once output stream closed
   */
  onceClose(cb: () => void): IDisposable {
    this.output.once('close', cb);
    return {
      dispose: () => {
        this.output.off('close', cb);
      },
    };
  }

  onError(cb: (err: Error) => void): IDisposable {
    this.input.on('error', cb);
    this.output.on('error', cb);
    return {
      dispose: () => {
        this.input.off('error', cb);
        this.output.off('error', cb);
      },
    };
  }

  dispose(): void {
    this.decoder.dispose();
  }
}
