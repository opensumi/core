import { Transform, TransformCallback, TransformOptions } from 'stream';

import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

// Sumi
export const kMagicNumber = 0x53756d69;

export const reader = BinaryReader({});
const writer = BinaryWriter({});

export function createSumiStreamPacket(content: Uint8Array) {
  writer.reset();
  writer.uint32(kMagicNumber);
  writer.varInt32(content.byteLength);
  writer.buffer(content);
  return writer.dump();
}

export function parseSumiStreamPacket(buffer: Uint8Array): Uint8Array {
  reader.reset(buffer);
  reader.skip(4);
  // todo: use bufferRef
  return reader.buffer(reader.varInt32());
}

export abstract class StreamPacketDecoder extends Transform {
  private _buffers: Uint8Array[];
  /**
   * Buffers total byte length
   */
  private _buffersByteLength: number;
  /**
   * Current packet byte length
   */
  private _packetByteLength: number;

  private _prefixLength: number;
  private _minByteLength: number;
  private _maxByteLength: number;

  constructor(options: { prefixLength: number } & TransformOptions) {
    super(options);
    this._prefixLength = options.prefixLength;
    this._buffers = [] as Uint8Array[];
    this._buffersByteLength = 0;
    this._packetByteLength = 0;
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

    if (!this._packetByteLength) {
      const buffer = this._buffers.length === 1 ? this._buffers[0] : Buffer.concat(this._buffers);
      this._packetByteLength = this.getPacketLength(buffer);

      if (this._minByteLength && this._packetByteLength < this._minByteLength) {
        throw new Error('Invalid document length');
      }

      if (this._maxByteLength && this._packetByteLength > this._maxByteLength) {
        throw new Error('Document exceeds configured maximum length');
      }
    }

    // Not enough data yet, wait for more data
    if (this._buffersByteLength < this._packetByteLength) {
      return true;
    }

    if (this._buffers.length === 1) {
      if (this._buffersByteLength === this._packetByteLength) {
        this.push(this._buffers[0]);
      } else {
        this.push(this._buffers[0].slice(0, this._packetByteLength));
      }
    } else {
      this.push(Buffer.concat(this._buffers, this._packetByteLength));
    }

    // Remove the consumed bytes from the buffers
    if (this._buffersByteLength > this._packetByteLength) {
      const lastBuffer = this._buffers[this._buffers.length - 1];

      // this._buffersByteLength -  this._packetByteLength 是剩余的字节数，这次没用完的
      // lastBuffer.byteLength 是最后一个 buffer 的字节数
      const start = lastBuffer.byteLength - (this._buffersByteLength - this._packetByteLength);

      this._buffers = [lastBuffer.subarray(start)];
      this._buffersByteLength -= this._packetByteLength;
      this._packetByteLength = 0;

      return false;
    }

    this._buffers = [];
    this._buffersByteLength = 0;
    this._packetByteLength = 0;

    return true;
  }

  /**
   * Return the number of bytes of the next packet
   *
   * Return 0 if the packet is not meet the requirement
   */
  abstract getPacketLength(buffer: Uint8Array): number;
}

export class SumiStreamPacketDecoder extends StreamPacketDecoder {
  reader = BinaryReader({});

  constructor() {
    super({
      /**
       * Sumi packet prefix length: 5 - 8 bytes
       */
      prefixLength: 5,
    });
  }

  getPacketLength(buffer: Uint8Array): number {
    this.reader.reset(buffer);

    const magicNumber = this.reader.uint32();
    if (magicNumber !== kMagicNumber) {
      throw new Error(`Invalid magic number: ${magicNumber}`);
    }
    const contentLen = this.reader.varInt32();
    return this.reader.getCursor() + contentLen;
  }
}
