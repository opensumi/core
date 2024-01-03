import { Transform, TransformCallback, TransformOptions } from 'stream';

import { alloc } from '@furyjs/fury/dist/lib/platformBuffer';
import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

export const kMagicNumber = 0b11111111;

export const reader = BinaryReader({});
const writer = BinaryWriter({});

const fastBuffer = alloc(8);

export function createSumiStreamPacket(content: Uint8Array) {
  writer.reset();
  writer.uint8(kMagicNumber);
  writer.varInt32(content.byteLength);
  writer.buffer(content);
  return writer.dump();
}

export abstract class StreamPacketDecoder extends Transform {
  private _buffers: Uint8Array[];
  /**
   * Buffers total byte length
   */
  private _buffersByteLength: number;
  /**
   * Packet content end = content start + content length
   */
  private _packetContentEnd: number;
  /**
   * Packet content start
   */
  private _packetContentStart: number;

  private _prefixLength: number;

  constructor(options: { prefixLength: number } & TransformOptions) {
    super(options);
    this._prefixLength = options.prefixLength;
    this._buffers = [] as Uint8Array[];
    this._buffersByteLength = 0;
    this._packetContentEnd = 0;
    this._packetContentStart = 0;
  }

  _transform(chunk: Uint8Array, encoding: string, callback: TransformCallback): void {
    this._buffersByteLength += chunk.byteLength;
    this._buffers.push(chunk);

    let done = false;

    while (!done) {
      done = this._parsePacket();
    }

    callback();
  }

  _parsePacket() {
    if (this._buffersByteLength < this._prefixLength) {
      return true;
    }

    if (!this._packetContentEnd) {
      [this._packetContentStart, this._packetContentEnd] = this.getPacketRange(Buffer.concat(this._buffers));
    }

    // Not enough data yet, wait for more data
    if (this._buffersByteLength < this._packetContentEnd) {
      return true;
    }

    if (this._buffers.length === 1) {
      if (this._buffersByteLength === this._packetContentEnd) {
        this.push(this._buffers[0].subarray(this._packetContentStart));
      } else {
        this.push(this._buffers[0].subarray(this._packetContentStart, this._packetContentEnd));
      }
    } else {
      this.push(Buffer.concat(this._buffers, this._packetContentEnd).subarray(this._packetContentStart));
    }

    // Remove the consumed bytes from the buffers
    if (this._buffersByteLength > this._packetContentEnd) {
      const lastBuffer = this._buffers[this._buffers.length - 1];

      // this._buffersByteLength -  this._packetByteLength 是剩余的字节数，这次没用完的
      // lastBuffer.byteLength 是最后一个 buffer 的字节数
      const start = lastBuffer.byteLength - (this._buffersByteLength - this._packetContentEnd);

      this._buffers = [lastBuffer.subarray(start)];
      this._buffersByteLength -= this._packetContentEnd;
      this._packetContentEnd = 0;
      this._packetContentStart = 0;

      return false;
    }

    this._buffers = [];
    this._buffersByteLength = 0;
    this._packetContentEnd = 0;
    this._packetContentStart = 0;

    return true;
  }

  /**
   * Return the start and end index of the packet
   */
  abstract getPacketRange(buffer: Uint8Array): [number, number];
}

export class SumiStreamPacketDecoder extends StreamPacketDecoder {
  reader = BinaryReader({});

  constructor() {
    super({
      /**
       * 1 byte magic number + 4 bytes content length
       */
      prefixLength: 5,
    });
  }

  getPacketRange(buffer: Uint8Array): [number, number] {
    this.reader.reset(buffer);

    const magicNumber = this.reader.uint8();
    if (magicNumber !== kMagicNumber) {
      throw new Error(`Invalid magic number: ${magicNumber}`);
    }
    const contentLen = this.reader.varInt32();
    const start = this.reader.getCursor();

    // remove reference to original buffer
    this.reader.reset(fastBuffer);
    return [start, start + contentLen];
  }
}
