import { PassThrough } from 'stream';

import {
  SumiStreamPacketDecoder,
  createSumiStreamPacket,
  kMagicNumber,
  parseSumiStreamPacket,
  reader,
} from '../../lib/common/connection/drivers/stream-packet';

describe('stream-packet', () => {
  it('can create sumi stream packet', () => {
    const content = new Uint8Array([1, 2, 3]);
    const packet = createSumiStreamPacket(content);

    reader.reset(packet);
    expect(reader.uint32()).toBe(kMagicNumber);
    expect(reader.varInt32()).toBe(content.byteLength);
    expect(Uint8Array.from(reader.buffer(content.byteLength))).toEqual(content);
  });

  it('can decode stream packet', async () => {
    function createPayload(size: number) {
      const payload = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        payload[i] = i % 256;
      }
      return payload;
    }

    const p1k = createPayload(1024);
    const p64k = createPayload(64 * 1024);
    const p128k = createPayload(128 * 1024);
    const p1m = createPayload(1024 * 1024);
    const p10m = createPayload(10 * 1024 * 1024);

    const packets = [p1k, p64k, p128k, p1m, p10m];

    await Promise.all(
      packets.map(async (packet) => {
        const decoder = new SumiStreamPacketDecoder();
        const pass = new PassThrough({
          write(chunk, encoding, callback) {
            // write chunk by size 64 * 1024
            for (let i = 0; i < chunk.byteLength; i += 64 * 1024) {
              this.push(chunk.slice(i, i + 64 * 1024));
            }
            callback();
          },
        });

        pass.write(createSumiStreamPacket(packet));

        const readable = pass.pipe(decoder);

        await new Promise<void>((resolve) => {
          readable.on('data', (data) => {
            expect(Uint8Array.from(parseSumiStreamPacket(data))).toEqual(packet);
            resolve();
          });
        });
      }),
    );
  });
});
