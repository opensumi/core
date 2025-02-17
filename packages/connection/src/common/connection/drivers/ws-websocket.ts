/* eslint-disable no-console */
import { IDisposable } from '@opensumi/ide-core-common';

import { chunkSize } from '../../constants';

import { BaseConnection } from './base';
import { LengthFieldBasedFrameDecoder } from './frame-decoder';

import type WebSocket from 'ws';

interface SendQueueItem {
  data: Uint8Array;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class WSWebSocketConnection extends BaseConnection<Uint8Array> {
  protected decoder = new LengthFieldBasedFrameDecoder();
  private static readonly MAX_QUEUE_SIZE = 1000; // 限制队列长度

  private sendQueue: SendQueueItem[] = [];
  private pendingSize = 0;
  private sending = false;

  constructor(public socket: WebSocket) {
    super();
    this.socket.on('message', (data: Buffer) => {
      this.decoder.push(data);
    });
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
          if (!this.isOpen()) {
            throw new Error('Connection closed while sending');
          }

          await new Promise<void>((resolve, reject) => {
            const chunk = packet.subarray(i, Math.min(i + chunkSize, packet.byteLength));
            this.socket.send(chunk, { binary: true }, (error?: Error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        }

        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        if (handle) {
          try {
            handle.dispose();
          } catch (error) {
            console.warn('[WSWebSocket] Error disposing handle:', error);
          }
        }
        this.pendingSize -= this.sendQueue[0].data.byteLength;
        this.sendQueue.shift();
      }
    }

    this.sending = false;
  }

  send(data: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // 检查队列大小限制
      if (this.sendQueue.length >= WSWebSocketConnection.MAX_QUEUE_SIZE) {
        reject(new Error('Send queue full'));
        return;
      }

      this.pendingSize += data.byteLength;
      this.sendQueue.push({ data, resolve, reject });
      this.processSendQueue().catch((error) => {
        console.error('[WSWebSocket] Error processing queue:', error);
      });
    });
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
    // 拒绝所有待发送的消息
    while (this.sendQueue.length > 0) {
      const { reject } = this.sendQueue.shift()!;
      reject(new Error('Connection disposed'));
    }
    this.pendingSize = 0;
    this.sending = false;
  }
}
