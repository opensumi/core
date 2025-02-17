/* eslint-disable no-console */
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
  private sendQueue: Array<{ data: Uint8Array; resolve: () => void; reject: (error: Error) => void }> = [];
  private sending = false;

  protected constructor(private socket: ReconnectingWebSocket) {
    super();

    if (socket.binaryType === 'arraybuffer') {
      this.socket.addEventListener('message', this.arrayBufferHandler);
    } else if (socket.binaryType === 'blob') {
      throw new Error('blob is not implemented');
    }
  }

  private async processSendQueue() {
    if (this.sending) {
      return;
    }
    this.sending = true;

    while (this.sendQueue.length > 0) {
      const { data, resolve, reject } = this.sendQueue[0];
      let handle: { get: () => Uint8Array; dispose: () => void } | null = null;

      try {
        handle = LengthFieldBasedFrameDecoder.construct(data).dumpAndOwn();
        const packet = handle.get();

        for (let i = 0; i < packet.byteLength; i += chunkSize) {
          await new Promise<void>((resolve) => {
            const chunk = packet.subarray(i, Math.min(i + chunkSize, packet.byteLength));
            this.socket.send(chunk);
            resolve();
          });
        }

        resolve();
      } catch (error) {
        console.error('[ReconnectingWebSocket] Error sending data:', error);
        reject(error);
      } finally {
        if (handle) {
          handle.dispose();
        }
      }
      this.sendQueue.shift();
    }

    this.sending = false;
  }

  send(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sendQueue.push({ data, resolve, reject });
      this.processSendQueue();
    });
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

  private arrayBufferHandler = (e: MessageEvent<ArrayBuffer>) => {
    const buffer: ArrayBuffer = e.data;
    this.decoder.push(new Uint8Array(buffer, 0, buffer.byteLength));
  };

  dispose(): void {
    this.socket.removeEventListener('message', this.arrayBufferHandler);
    this.sendQueue = [];
    this.sending = false;
  }

  static forURL(url: UrlProvider, protocols?: string | string[], options?: ReconnectingWebSocketOptions) {
    const rawConnection = new ReconnectingWebSocket(url, protocols, options);
    rawConnection.binaryType = 'arraybuffer';
    return new ReconnectingWebSocketConnection(rawConnection);
  }
}
