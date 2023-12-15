import { Transform, TransformCallback, TransformOptions } from 'stream';

import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

// Sumi
export const kMagicNumber = 0x53756d69;

type TBinaryReader = ReturnType<typeof BinaryReader>;

export const reader = BinaryReader({});
const writer = BinaryWriter({});

export function createStreamPacket(content: Uint8Array) {
  writer.reset();
  writer.uint32(kMagicNumber);
  writer.varInt32(content.byteLength);
  writer.buffer(content);
  return writer.dump();
}

export abstract class PacketStreamDecoder extends Transform {
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
  reader = BinaryReader({});

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
      this.reader.reset(buffer);
      this._packetByteLength = this.getPacketLength(this.reader);

      if (this._minByteLength && this._packetByteLength < this._minByteLength) {
        throw new Error('Invalid document length');
      }

      if (this._maxByteLength && this._packetByteLength > this._maxByteLength) {
        throw new Error('Document exceeds configured maximum length');
      }
    }

    const fullPacketLength = this._prefixLength + this._packetByteLength;

    // Not enough data yet, wait for more data
    if (this._buffersByteLength < fullPacketLength) {
      return true;
    }

    // todo: use bufferRef
    this.push(this.reader.buffer(this._packetByteLength));

    // Remove the consumed bytes from the buffers
    if (this._buffersByteLength > fullPacketLength) {
      const lastBuffer = this._buffers[this._buffers.length - 1];
      // Reader 使用过的字节数
      const usedBytes = this.reader.getCursor();

      // this._buffersByteLength - usedBytes 是剩余的字节数，这次没用完的
      // lastBuffer.byteLength 是最后一个 buffer 的字节数
      const start = lastBuffer.byteLength - (this._buffersByteLength - usedBytes);

      this._buffers = [lastBuffer.subarray(start)];
      this._buffersByteLength -= usedBytes;
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
  abstract getPacketLength(reader: TBinaryReader): number;
}

export class StreamPacketDecoder extends PacketStreamDecoder {
  constructor(options: { prefixLength: number } & TransformOptions) {
    super(options);
  }

  getPacketLength(reader: TBinaryReader): number {
    const magicNumber = reader.uint32();
    if (magicNumber !== kMagicNumber) {
      throw new Error(`Invalid magic number: ${magicNumber}`);
    }
    return reader.varInt32();
  }
}
