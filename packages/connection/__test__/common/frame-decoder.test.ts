/* eslint-disable no-console */
import { BinaryReader } from '@furyjs/fury/dist/lib/reader';

import { LengthFieldBasedFrameDecoder, indicator } from '../../src/common/connection/drivers/frame-decoder';

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

const purePackets = [p1k, p64k, p128k, p5m, p10m].map((v) => [LengthFieldBasedFrameDecoder.construct(v), v] as const);

const size = purePackets.reduce((acc, v) => acc + v[0].byteLength, 0);

let offset = 0;
const bigPayload = createPayload(size);
purePackets.forEach((v) => {
  const sumiPacket = v[0];
  bigPayload.set(sumiPacket, offset);
  offset += sumiPacket.byteLength;
});

const mixedPackets = [p1m, p5m].map((v) => {
  const sumiPacket = LengthFieldBasedFrameDecoder.construct(v);
  const newPacket = createPayload(1024 + sumiPacket.byteLength);
  newPacket.set(sumiPacket, 1024);
  return [newPacket, v] as const;
});

const packets = [...purePackets, ...mixedPackets];

describe('frame decoder', () => {
  it('can create frame', () => {
    const content = new Uint8Array([1, 2, 3]);
    const packet = LengthFieldBasedFrameDecoder.construct(content);
    const reader = BinaryReader({});

    reader.reset(packet);
    expect(Uint8Array.from(reader.buffer(4))).toEqual(indicator);
    expect(reader.uint32()).toBe(content.byteLength);
    expect(Uint8Array.from(reader.buffer(content.byteLength))).toEqual(content);
  });

  packets.forEach(([packet, expected]) => {
    it(`can decode stream: ${round(packet.byteLength / 1024 / 1024, 2)}m`, (done) => {
      const decoder = new LengthFieldBasedFrameDecoder();

      decoder.onData((data) => {
        fastExpectBufferEqual(data, expected);
        decoder.dispose();
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

  it('can decode a stream payload contains multiple frames', (done) => {
    const decoder = new LengthFieldBasedFrameDecoder();
    const expectCount = purePackets.length;
    let count = 0;
    decoder.onData((data) => {
      const expected = purePackets[count][1];
      fastExpectBufferEqual(data, expected);

      count++;
      if (count === expectCount) {
        decoder.dispose();
        done();
      }
    });

    console.log('write chunk', bigPayload.byteLength);
    // write chunk by ${pressure} bytes
    for (let i = 0; i < bigPayload.byteLength; i += pressure) {
      decoder.push(bigPayload.subarray(i, i + pressure));
      logMemoryUsage();
    }

    logMemoryUsage();
  });

  it('can decode a stream it has no valid length info', (done) => {
    const v = createPayload(1024);
    const sumiPacket = LengthFieldBasedFrameDecoder.construct(v);

    const decoder = new LengthFieldBasedFrameDecoder();
    decoder.onData((data) => {
      fastExpectBufferEqual(data, v);
      done();
    });

    console.log('write chunk', sumiPacket.byteLength);
    // use pressure = 2 to simulate the header and payload are separated
    const pressure = 2;
    for (let i = 0; i < sumiPacket.byteLength; i += pressure) {
      decoder.push(sumiPacket.subarray(i, i + pressure));
    }
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

function fastExpectBufferEqual(data: Uint8Array, expected: Uint8Array, confidenceLevel = 10) {
  expect(data.byteLength).toEqual(expected.byteLength);

  for (let i = 0; i < confidenceLevel; i++) {
    // 如果对比整个 Uint8Array 的话，超大 Uint8Array 会很耗时
    // 随机选一些数据(<= 1024 字节)，对比是否正确，
    const start = Math.floor(Math.random() * data.byteLength);
    const end = Math.floor(Math.random() * 1024);

    expect(data.subarray(start, end)).toEqual(expected.subarray(start, end));
  }
}
