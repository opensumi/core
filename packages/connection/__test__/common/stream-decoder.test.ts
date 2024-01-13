/* eslint-disable no-console */

import { BinaryReader } from '@furyjs/fury/dist/lib/reader';

import {
  StreamPacketDecoder,
  createSumiStreamPacket,
  kMagicNumber,
} from '../../src/common/connection/drivers/stream-decoder';

const reader = BinaryReader({});

function round(x: number, count: number) {
  return Math.round(x * 10 ** count) / 10 ** count;
}

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

const h1m = createPayload(1024 + p1m.byteLength);
h1m.set(p1m, 1024);

const h5m = createPayload(1024 + p5m.byteLength + 233);
h5m.set(p5m, 1024);

console.timeEnd('createPayload');

// 1m
const pressure = 1024 * 1024;

const purePackets = [p1k, p64k, p128k, p5m, p10m].map((v) => [createSumiStreamPacket(v), v] as const);

const mixedPackets = [p1m, p5m].map((v) => {
  const sumiPacket = createSumiStreamPacket(v);
  const newPacket = createPayload(1024 + sumiPacket.byteLength);
  newPacket.set(sumiPacket, 1024);
  return [newPacket, v] as const;
});

const packets = [...purePackets, ...mixedPackets];

describe('stream-packet', () => {
  it('can create sumi stream packet', () => {
    const content = new Uint8Array([1, 2, 3]);
    const packet = createSumiStreamPacket(content);

    reader.reset(packet);
    expect(reader.uint32()).toBe(kMagicNumber);
    expect(reader.varUInt32()).toBe(content.byteLength);
    expect(Uint8Array.from(reader.buffer(content.byteLength))).toEqual(content);
  });

  packets.forEach(([packet, expected]) => {
    it(`can decode stream packet: ${round(packet.byteLength / 1024 / 1024, 2)}m`, (done) => {
      const decoder = new StreamPacketDecoder();

      decoder.onData((data) => {
        expect(data.byteLength).toEqual(expected.byteLength);
        for (let i = 0; i < 10; i++) {
          // 随机选一些数据(<= 100字节)，对比是否正确，对比整个数组的话，超大 buffer 会很耗时
          const start = Math.floor(Math.random() * data.byteLength);
          const end = Math.floor(Math.random() * 1024);

          expect(data.subarray(start, end)).toEqual(expected.subarray(start, end));
        }

        done();
      });

      console.log('write chunk', packet.byteLength);
      // write chunk by ${pressure} bytes
      for (let i = 0; i < packet.byteLength; i += pressure) {
        decoder.push(packet.subarray(i, i + pressure));
        logMemoryUsage();
      }

      logMemoryUsage();
    });
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
