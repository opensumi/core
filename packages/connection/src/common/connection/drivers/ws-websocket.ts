import { IDisposable } from '@opensumi/ide-core-common';

import { chunkSize } from '../../constants';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder } from './frame-decoder';

import type WebSocket from 'ws';

export class WSWebSocketConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();

  constructor(public socket: WebSocket) {
    super();
    this.socket.on('message', (data: Buffer) => {
      this.decoder.push(data);
    });
  }

  send(data: Uint8Array): void {
    const packet = LengthFieldBasedFrameDecoder.construct(data);
    for (let i = 0; i < packet.byteLength; i += chunkSize) {
      this.socket.send(packet.subarray(i, i + chunkSize));
    }
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

  isOpen() {
    return this.socket.readyState === this.socket.OPEN;
  }

  dispose(): void {
    this.socket.removeAllListeners();
  }
}
