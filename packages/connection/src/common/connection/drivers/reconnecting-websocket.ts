import { IDisposable } from '@opensumi/ide-core-common';
import ReconnectingWebSocket, {
  Options as ReconnectingWebSocketOptions,
  UrlProvider,
} from '@opensumi/reconnecting-websocket';

import { chunkSize } from '../../constants';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder } from './frame-decoder';

import type { ErrorEvent } from '@opensumi/reconnecting-websocket';

export class ReconnectingWebSocketConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();

  constructor(private socket: ReconnectingWebSocket) {
    super();

    this.socket.addEventListener('message', this.dataHandler);
  }

  send(data: Uint8Array): void {
    const handle = LengthFieldBasedFrameDecoder.construct(data).dumpAndOwn();
    const packet = handle.get();
    for (let i = 0; i < packet.byteLength; i += chunkSize) {
      this.socket.send(packet.subarray(i, i + chunkSize));
    }

    handle.dispose();
  }

  isOpen(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }

  onOpen(cb: () => void): IDisposable {
    this.socket.addEventListener('open', cb);
    return {
      dispose: () => {
        this.socket.removeEventListener('open', cb);
      },
    };
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
    const handler = (e: CloseEvent) => {
      cb(e.code, e.reason);
    };

    this.socket.addEventListener('close', handler);
    return {
      dispose: () => {
        this.socket.removeEventListener('close', handler);
      },
    };
  }
  onError(cb: (e: Error) => void): IDisposable {
    const handler = (e: ErrorEvent) => {
      cb(e.error);
    };

    this.socket.addEventListener('error', handler);
    return {
      dispose: () => {
        this.socket.removeEventListener('error', handler);
      },
    };
  }

  private dataHandler = (e: MessageEvent) => {
    let buffer: Promise<ArrayBuffer>;
    if (e.data instanceof Blob) {
      buffer = e.data.arrayBuffer();
    } else if (e.data instanceof ArrayBuffer) {
      buffer = Promise.resolve(e.data);
    } else if (e.data?.constructor?.name === 'Buffer') {
      // Compatibility with nodejs Buffer in test environment
      buffer = Promise.resolve(e.data);
    } else {
      throw new Error('unknown message type, expect Blob or ArrayBuffer, received: ' + typeof e.data);
    }
    buffer.then((v) => this.decoder.push(new Uint8Array(v, 0, v.byteLength)));
  };

  dispose(): void {
    this.socket.removeEventListener('message', this.dataHandler);
  }

  static forURL(url: UrlProvider, protocols?: string | string[], options?: ReconnectingWebSocketOptions) {
    const rawConnection = new ReconnectingWebSocket(url, protocols, options);
    rawConnection.binaryType = 'arraybuffer';
    return new ReconnectingWebSocketConnection(rawConnection);
  }
}
