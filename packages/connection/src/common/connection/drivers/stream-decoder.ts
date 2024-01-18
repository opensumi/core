import { BinaryReader } from '@furyjs/fury/dist/lib/reader';
import { BinaryWriter } from '@furyjs/fury/dist/lib/writer';

import { EventEmitter } from '@opensumi/events';

import { Buffers } from '../buffers';

export const kMagicNumber = 0x53756d69;

const writer = BinaryWriter({});

/**
 * When we send data through net.Socket, the data is not guaranteed to be sent as a whole.
 *
 * So we need to add a header to the data, so that the receiver can know the length of the data,
 * The header is 4 bytes, the first 4 bytes is a magic number, which is `Sumi` in little endian.
 * use magic number can help us to detect the start of the packet in the stream.
 * > You can use `Buffer.from('Sumi')` to get this magic number
 *
 * The next 4 bytes is a varUInt32, which means the length of the following data, and
 * the following data is the content.
 */
export function createStreamPacket(content: Uint8Array) {
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

  protected buffers = new Buffers();
  protected cursor = this.buffers.cursor();

  protected reader = BinaryReader({});

  protected packetState = 0;
  protected packetContentLength = 0;

  reset() {
    this.packetState = 0;
    this.packetContentLength = 0;

    this.cursor.reset();
  }

  push(chunk: Uint8Array): void {
    this.buffers.push(chunk);
    let done = false;

    while (!done) {
      done = this.readPacket();
    }
  }

  protected readPacket(): boolean {
    const found = this.readPacketHeader();

    if (found) {
      const start = this.cursor.offset;
      const end = start + this.packetContentLength;

      const binary = this.buffers.slice(start, end);

      this.emitter.emit('data', binary);

      if (this.buffers.byteLength > end) {
        this.cursor.moveTo(end);
        this.packetState = 0;
        this.packetContentLength = 0;
        // has more data, continue to parse
        return false;
      }

      this.buffers.splice(0, end);
      this.reset();
    }

    return true;
  }

  /**
   * First we read the first 4 bytes, if it is not magic 4 bytes
   * discard it and continue to read the next byte until we get magic 4 bytes
   * Then read the next byte, this is a varUint32, which means the length of the following data
   * Then read the following data, until we get the length of varUint32, then return this data and continue to read the next packet
   */
  protected readPacketHeader() {
    if (this.buffers.byteLength === 0) {
      return false;
    }

    if (this.packetState !== 4) {
      this.readPacketMagicNumber();
    }

    if (this.packetState !== 4) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (this.cursor.offset + 4 > this.buffers.byteLength) {
      // Not enough data yet, wait for more data
      return false;
    }

    if (!this.packetContentLength) {
      // read the content length
      const buffers = this.buffers.slice(this.cursor.offset, this.cursor.offset + 4);
      this.reader.reset(buffers);
      this.packetContentLength = this.reader.varUInt32();
      this.cursor.move(this.reader.getCursor());
    }

    if (this.cursor.offset + this.packetContentLength > this.buffers.byteLength) {
      // Not enough data yet, wait for more data
      return false;
    }

    return true;
  }

  protected readPacketMagicNumber() {
    const iter = this.cursor.iterator();

    let result = iter.next();
    while (!result.done) {
      // Fury use little endian to store data
      switch (result.value) {
        case 0x69:
          switch (this.packetState) {
            case 0:
              this.packetState = 1;
              break;
            default:
              this.packetState = 0;
              break;
          }
          break;
        case 0x6d:
          switch (this.packetState) {
            case 1:
              this.packetState = 2;
              break;
            default:
              this.packetState = 0;
              break;
          }
          break;
        case 0x75:
          switch (this.packetState) {
            case 2:
              this.packetState = 3;
              break;
            default:
              this.packetState = 0;
              break;
          }
          break;
        case 0x53:
          switch (this.packetState) {
            case 3:
              this.packetState = 4;
              iter.return();
              break;
            default:
              this.packetState = 0;
              break;
          }
          break;
        default:
          this.packetState = 0;
          break;
      }
      result = iter.next();
    }
  }

  onData(cb: (data: Uint8Array) => void) {
    return this.emitter.on('data', cb);
  }

  dispose() {
    this.reader = BinaryReader({});
    this.emitter.dispose();
    this.buffers.dispose();
  }
}
