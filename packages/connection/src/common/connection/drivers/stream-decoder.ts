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
  writer.varUInt32(content.byteLength);
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

      if (this._buffers.byteLength > 0) {
        // has more data, continue to parse
        return false;
      }

      return true;
    }

    return true;
  }

  /**
   * First we read the first 4 bytes, if it is not magic 4 bytes
   * discard it and continue to read the next byte until we get magic 4 bytes
   * magic 4 bytes is 0x69 0x6d 0x75 0x53
   * Then read the next byte, this is a varUint32, which means the length of the following data
   * Then read the following data, until we get the length of varUint32, then return this data and continue to read the next packet
   */
  _detectPacketHeader() {
    if (this._buffers.byteLength === 0) {
      return false;
    }

    if (this._tmpPacketState !== 4) {
      this._tmpChunksTotalBytesCursor = this._detectPacketMagicNumber();
    }

    if (this._tmpPacketState !== 4) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (this._tmpChunksTotalBytesCursor + 4 > this._buffers.byteLength) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (!this._tmpContentLength) {
      // read the content length
      const buffers = this._buffers.slice(this._tmpChunksTotalBytesCursor, this._tmpChunksTotalBytesCursor + 4);
      this.reader.reset(buffers);
      this._tmpContentLength = this.reader.varUInt32();
      this._tmpChunksTotalBytesCursor += this.reader.getCursor();
    }

    if (this._tmpChunksTotalBytesCursor + this._tmpContentLength > this._buffers.byteLength) {
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
