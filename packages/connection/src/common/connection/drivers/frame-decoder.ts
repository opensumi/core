/* eslint-disable no-console */
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { MaybeNull, readUInt32LE } from '@opensumi/ide-core-common';

import { Buffers } from '../../buffers/buffers';

/**
 * You can use `Buffer.from('\r\n\r\n')` to get this indicator.
 */
export const indicator = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);

/**
 * The number of bytes in the length field.
 *
 * How many bytes are used to represent data length.
 *
 * For example, if the length field is 4 bytes, then the maximum length of the data is 2^32 = 4GB
 */
const lengthFieldLength = 4;

/**
 * sticky packet unpacking problems are generally problems at the transport layer.
 * we use a length field to represent the length of the data, and then read the data according to the length
 */
export class LengthFieldBasedFrameDecoder {
  private static readonly MAX_ITERATIONS = 50;

  private _onDataListener: MaybeNull<(data: Uint8Array) => void>;
  onData(listener: (data: Uint8Array) => void) {
    this._onDataListener = listener;
    return {
      dispose: () => {
        this._onDataListener = null;
      },
    };
  }

  protected buffers = new Buffers();
  protected cursor = this.buffers.cursor();
  private processingPromise: Promise<void> | null = null;

  protected contentLength = -1;

  protected state = 0;

  reset() {
    this.contentLength = -1;
    this.state = 0;
    this.cursor.reset();
  }

  push(chunk: Uint8Array): void {
    this.buffers.push(chunk);

    // 确保同一时间只有一个处理过程
    if (!this.processingPromise) {
      this.processingPromise = this.processBuffers().finally(() => {
        this.processingPromise = null;
      });
    }
  }

  private async processBuffers(): Promise<void> {
    let iterations = 0;
    let hasMoreData = false;

    do {
      hasMoreData = false;
      while (iterations < LengthFieldBasedFrameDecoder.MAX_ITERATIONS) {
        if (this.buffers.byteLength === 0) {
          break;
        }

        const result = await this.readFrame();
        if (result === true) {
          break;
        }

        iterations++;
        if (iterations % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // 检查剩余数据
      if (this.buffers.byteLength > 0) {
        hasMoreData = true;
        // 异步继续处理，避免阻塞
        await new Promise((resolve) => setImmediate(resolve));
        iterations = 0; // 重置迭代计数器
      }
    } while (hasMoreData);
  }

  protected async readFrame(): Promise<boolean> {
    try {
      const found = this.readLengthField();
      if (!found) {
        return true;
      }

      const start = this.cursor.offset;
      const end = start + this.contentLength;

      if (end > this.buffers.byteLength) {
        return true;
      }

      const binary = this.buffers.slice(start, end);

      // 立即清理已处理的数据
      this.buffers.splice(0, end);
      this.reset();

      if (this._onDataListener) {
        try {
          await Promise.resolve().then(() => this._onDataListener?.(binary));
        } catch (error) {
          console.error('[Frame Decoder] Error in data listener:', error);
        }
      }

      return false;
    } catch (error) {
      console.error('[Frame Decoder] Error processing frame:', error);
      this.reset();
      return true;
    }
  }

  protected readLengthField() {
    const bufferLength = this.buffers.byteLength;

    if (this.state !== 4) {
      if (this.cursor.offset + indicator.length > bufferLength) {
        // Not enough data yet, wait for more data
        return false;
      }

      this.readIndicator();
    }

    if (this.state !== 4) {
      // Not a complete indicator yet, wait for more data
      return false;
    }

    if (this.contentLength === -1) {
      if (this.cursor.offset + lengthFieldLength > bufferLength) {
        // Not enough data yet, wait for more data
        return false;
      }

      // read the content length
      const buf = this.cursor.read4();
      // fury writer use little endian
      this.contentLength = readUInt32LE(buf, 0);
    }

    if (this.cursor.offset + this.contentLength > bufferLength) {
      // Not enough data yet, wait for more data
      return false;
    }

    return true;
  }

  protected readIndicator() {
    const iter = this.cursor.iterator();

    let result = iter.next();
    while (!result.done) {
      switch (result.value) {
        case 0x0d: // \r
          switch (this.state) {
            case 0:
              this.state = 1;
              break;
            case 2: // 第二个 \r
              this.state = 3;
              break;
            default:
              this.state = 0;
              break;
          }
          break;
        case 0x0a: // \n
          switch (this.state) {
            case 1:
              this.state = 2;
              break;
            case 3: // 第二个 \n
              this.state = 4;
              iter.return();
              break;
            default:
              this.state = 0;
              break;
          }
          break;
        default:
          this.state = 0;
          break;
      }
      result = iter.next();
    }
  }

  dispose() {
    this._onDataListener = null;
    this.buffers.dispose();
    this.reset();
  }

  static construct(content: Uint8Array) {
    // 每次都创建新的 writer，避免所有权问题
    const writer = BinaryWriter({});

    try {
      writer.buffer(indicator);
      writer.uint32(content.byteLength);
      writer.buffer(content);
      return writer;
    } catch (error) {
      console.warn('[Frame Decoder] Error constructing frame:', error);
      throw error;
    }
  }
}
