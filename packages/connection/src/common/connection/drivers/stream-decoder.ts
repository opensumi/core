import { alloc } from '@furyjs/fury/dist/lib/platformBuffer';
import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { EventEmitter } from '@opensumi/events';

import { Buffers } from '../buffers';

export const kMagicNumber = 0x53756d69;

const writer = BinaryWriter({});

const emptyBuffer = alloc(8);

export function createSumiStreamPacket(content: Uint8Array) {
  writer.reset();
  writer.uint32(kMagicNumber);
  writer.varInt32(content.byteLength);
  writer.buffer(content);
  return writer.dump();
}

export class StreamPacketDecoder {
  protected emitter = new EventEmitter<{
    data: [Uint8Array];
  }>();

  protected _buffers = new Buffers();

  protected reader = BinaryReader({});

  protected _tmpChunksTotalBytesCursor: number;
  protected _tmpPacketState: number;
  protected _tmpContentLength: number;

  constructor() {
    this.reset();
  }

  reset() {
    this._tmpChunksTotalBytesCursor = 0;
    this._tmpPacketState = 0;
    this._tmpContentLength = 0;
  }

  push(chunk: Uint8Array): void {
    this._buffers.push(chunk);
    let done = false;

    while (!done) {
      done = this._parsePacket();
    }
  }

  _parsePacket(): boolean {
    const found = this._detectPacketHeader();
    if (found) {
      const fullBinary = this._buffers.splice(0, this._tmpChunksTotalBytesCursor + this._tmpContentLength);
      const binary = fullBinary.splice(this._tmpChunksTotalBytesCursor, this._tmpContentLength).slice();
      this.emitter.emit('data', binary);
      this.reset();

      if (this._buffers.length > 0) {
        // has more data, continue to parse
        return false;
      }

      return true;
    }

    return true;
  }

  /**
   * 首先我们读开头的 4 个字节，如果不是 0x69 0x6d 0x75 0x53，就丢弃，继续读下一个字节，直到读到 0x69 0x6d 0x75 0x53
   * 然后读下一个字节，这个字节是一个 varint32，表示后面的数据的长度
   * 然后读后面的数据，直到读到 varint32 表示的长度，然后把这个数据返回，然后继续读下一个数据包
   */
  _detectPacketHeader() {
    if (this._buffers.length === 0) {
      return false;
    }

    if (this._tmpPacketState !== 4) {
      this._tmpChunksTotalBytesCursor = this._detectPacketMagicNumber();
    }

    if (this._tmpPacketState !== 4) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (this._tmpChunksTotalBytesCursor + 4 > this._buffers.length) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (!this._tmpContentLength) {
      // read the content length
      const buffers = this._buffers.slice(this._tmpChunksTotalBytesCursor, this._tmpChunksTotalBytesCursor + 4);
      this.reader.reset(buffers);
      this._tmpContentLength = this.reader.varInt32();
      this._tmpChunksTotalBytesCursor += this.reader.getCursor();
      this.reader.reset(emptyBuffer);
    }

    if (this._tmpChunksTotalBytesCursor + this._tmpContentLength > this._buffers.length) {
      // Not enough data yet, wait for more data
      return false;
    }

    return true;
  }

  _detectPacketMagicNumber() {
    let chunkIndex = 0;
    let chunkCursor = 0;

    // try read the magic number
    row: while (chunkIndex < this._buffers.buffers.length) {
      const chunk = this._buffers.buffers[chunkIndex];
      const chunkLength = chunk.byteLength;

      let chunkOffset = 0;

      while (chunkOffset < chunkLength) {
        const num = chunk[chunkOffset];
        chunkOffset++;
        chunkCursor++;

        // Fury use little endian to store data
        switch (num) {
          case 0x69:
            switch (this._tmpPacketState) {
              case 0:
                this._tmpPacketState = 1;
                break;
              default:
                this._tmpPacketState = 0;
                break;
            }
            break;
          case 0x6d:
            switch (this._tmpPacketState) {
              case 1:
                this._tmpPacketState = 2;
                break;
              default:
                this._tmpPacketState = 0;
                break;
            }
            break;
          case 0x75:
            switch (this._tmpPacketState) {
              case 2:
                this._tmpPacketState = 3;
                break;
              default:
                this._tmpPacketState = 0;
                break;
            }
            break;
          case 0x53:
            switch (this._tmpPacketState) {
              case 3:
                this._tmpPacketState = 4;
                break row;
              default:
                this._tmpPacketState = 0;
                break;
            }
            break;
          default:
            this._tmpPacketState = 0;
            break;
        }
      }

      chunkIndex++;
    }

    return chunkCursor;
  }

  onData(cb: (data: Uint8Array) => void) {
    return this.emitter.on('data', cb);
  }
}
