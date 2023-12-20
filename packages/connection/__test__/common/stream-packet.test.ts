/* eslint-disable no-console */
import { PassThrough } from 'stream';

import { pSeries } from '@opensumi/ide-core-common';

import {
  SumiStreamPacketDecoder,
  createSumiStreamPacket,
  kMagicNumber,
  reader,
} from '../../src/common/connection/drivers/stream-packet';

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

    console.time('createPayload');
    const p1k = createPayload(1024);
    const p64k = createPayload(64 * 1024);
    const p128k = createPayload(128 * 1024);
    const p1m = createPayload(1024 * 1024);
    const p5m = createPayload(5 * 1024 * 1024);
    const p10m = createPayload(10 * 1024 * 1024);
    console.timeEnd('createPayload');

    const pressure = 256 * 1024;
    const packets = [p1k, p64k, p128k, p1m, p5m, p10m];

    await pSeries(
      packets.map((packet) => async () => {
        const decoder = new SumiStreamPacketDecoder();

        const pass = new PassThrough({
          write(chunk: Uint8Array, encoding, callback) {
            console.log('write chunk', chunk.byteLength);
            // write chunk by ${pressure} bytes
            for (let i = 0; i < chunk.byteLength; i += pressure) {
              this.push(chunk.subarray(i, i + pressure));
            }
            logMemoryUsage();

            callback();
          },
        });

        pass.write(createSumiStreamPacket(packet));
        logMemoryUsage();
        const readable = pass.pipe(decoder);

        await new Promise<void>((resolve) => {
          readable.on('data', (data) => {
            expect(Uint8Array.from(data)).toEqual(packet);
            resolve();
          });
        });
      }),
    );
  });
});

function logMemoryUsage() {
  const used = process.memoryUsage();
  let text = new Date().toLocaleString('zh') + ' Memory usage:\n';
  // eslint-disable-next-line guard-for-in
  for (const key in used) {
    text += `${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB\n`;
  }

  console.log(text);
}
