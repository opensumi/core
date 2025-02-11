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

const purePackets = [p1k, p64k, p128k, p5m, p10m].map(
  (v) => [LengthFieldBasedFrameDecoder.construct(v).dump(), v] as const,
);

const size = purePackets.reduce((acc, v) => acc + v[0].byteLength, 0);

let offset = 0;
const bigPayload = createPayload(size);
purePackets.forEach((v) => {
  const sumiPacket = v[0];
  bigPayload.set(sumiPacket, offset);
  offset += sumiPacket.byteLength;
});

const mixedPackets = [p1m, p5m].map((v) => {
  const sumiPacket = LengthFieldBasedFrameDecoder.construct(v).dump();
  const newPacket = createPayload(1024 + sumiPacket.byteLength);
  newPacket.set(sumiPacket, 1024);
  return [newPacket, v] as const;
});

const packets = [...purePackets, ...mixedPackets];

describe('frame decoder', () => {
  it('can create frame', () => {
    const content = new Uint8Array([1, 2, 3]);
    const packet = LengthFieldBasedFrameDecoder.construct(content).dump();
    const reader = BinaryReader({});

    reader.reset(packet);
    expect(Uint8Array.from(reader.buffer(4))).toEqual(indicator);
    expect(reader.uint32()).toBe(content.byteLength);
    expect(Uint8Array.from(reader.buffer(content.byteLength))).toEqual(content);
  });

  packets.forEach(([packet, expected]) => {
    it(`can decode stream: ${round(packet.byteLength / 1024 / 1024, 2)}m`, async () => {
      const decoder = new LengthFieldBasedFrameDecoder();

      const result = await new Promise<Uint8Array>((resolve) => {
        decoder.onData((data) => resolve(data));

        // Push the full packet - the decoder will handle chunking internally
        decoder.push(packet);
      });

      fastExpectBufferEqual(result, expected);
      decoder.dispose();
    });
  });

  it('can decode a stream payload contains multiple frames', async () => {
    const decoder = new LengthFieldBasedFrameDecoder();
    const receivedData: Uint8Array[] = [];
    let resolved = false;

    const dataPromise = new Promise<void>((resolve) => {
      decoder.onData((data) => {
        receivedData.push(data);
        if (receivedData.length === purePackets.length && !resolved) {
          resolved = true;
          resolve();
        }
      });
    });

    // Push the full payload - the decoder will handle chunking internally
    decoder.push(bigPayload);

    await dataPromise;

    // Verify all packets were received in order
    receivedData.forEach((data, index) => {
      fastExpectBufferEqual(data, purePackets[index][1]);
    });

    decoder.dispose();
  });

  it('can decode a stream it has no valid length info', async () => {
    const v = createPayload(1024);
    const sumiPacket = LengthFieldBasedFrameDecoder.construct(v).dump();

    const decoder = new LengthFieldBasedFrameDecoder();
    const result = await new Promise<Uint8Array>((resolve) => {
      decoder.onData((data) => resolve(data));
      decoder.push(sumiPacket);
    });

    fastExpectBufferEqual(result, v);
    decoder.dispose();
  });

  // 测试分块传输场景
  it('should handle chunked packets with split indicator', async () => {
    const content = new Uint8Array([1, 2, 3]);
    const fullPacket = LengthFieldBasedFrameDecoder.construct(content).dump();

    // 将数据包拆分为三部分：指示符前半、指示符后半+长度、内容
    const chunks = [
      fullPacket.subarray(0, 2), // 0D 0A
      fullPacket.subarray(2, 6), // 0D 0A + 长度字段前2字节
      fullPacket.subarray(6), // 剩余数据
    ];

    const decoder = new LengthFieldBasedFrameDecoder();
    const result = await new Promise<Uint8Array>((resolve) => {
      decoder.onData(resolve);

      // 分三次推送数据
      chunks.forEach((chunk, i) => {
        setTimeout(() => decoder.push(chunk), i * 10);
      });
    });

    fastExpectBufferEqual(result, content);
  });

  // 测试高频小数据包压力
  it('should handle 1000 sequential small packets', async () => {
    const decoder = new LengthFieldBasedFrameDecoder();
    const received: Uint8Array[] = [];

    decoder.onData((data) => received.push(data));

    // 生成1000个独立数据包
    for (let i = 0; i < 1000; i++) {
      const packet = LengthFieldBasedFrameDecoder.construct(new Uint8Array([i % 256])).dump();

      decoder.push(packet);
    }

    // 等待处理完成
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(received.length).toBe(1000);
    received.forEach((data, i) => {
      expect(data[0]).toBe(i % 256);
    });
  });

  // 测试内存稳定性
  it('should not leak memory after processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const decoder = new LengthFieldBasedFrameDecoder();
      const packet = LengthFieldBasedFrameDecoder.construct(
        createPayload(1024 * 1024), // 1MB payload
      ).dump();

      await new Promise<void>((resolve) => {
        decoder.onData(() => resolve());
        decoder.push(packet);
      });

      decoder.dispose();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    expect(finalMemory - initialMemory).toBeLessThan(5 * 1024 * 1024); // 允许5MB波动
  });

  // 测试空数据包处理
  it('should handle zero-length payload', async () => {
    const decoder = new LengthFieldBasedFrameDecoder();
    const emptyPacket = LengthFieldBasedFrameDecoder.construct(new Uint8Array(0)).dump();

    const result = await new Promise<Uint8Array>((resolve) => {
      decoder.onData(resolve);
      decoder.push(emptyPacket);
    });

    expect(result.byteLength).toBe(0);
  });

  // 测试并发推送
  it('should handle concurrent pushes', async () => {
    const decoder = new LengthFieldBasedFrameDecoder();
    const content = new Uint8Array([1, 2, 3]);
    const packet = LengthFieldBasedFrameDecoder.construct(content).dump();

    const chunk1 = packet.subarray(0, 4);
    const chunk2 = packet.subarray(4);

    const resultPromise = new Promise<Uint8Array>((resolve) => {
      decoder.onData(resolve);
    });

    // 同时推送两个chunk
    await Promise.all([decoder.push(chunk1), decoder.push(chunk2)]);

    const result = await resultPromise;
    fastExpectBufferEqual(result, content);
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
