import { Buffers, copy } from '../../src/common/buffers/buffers';

describe('Buffers', () => {
  it('can push and slice', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

    expect(list.slice(0, 0)).toEqual(new Uint8Array(0));
    expect(list.slice(0, 2)).toEqual(new Uint8Array([1, 2]));
    expect(list.slice(0, 7)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));

    expect(list.slice(1, 1)).toEqual(new Uint8Array(0));
    expect(list.slice(1, 5)).toEqual(new Uint8Array([2, 3, 4, 5]));
    expect(list.slice(1, 7)).toEqual(new Uint8Array([2, 3, 4, 5, 6]));

    expect(list.slice(2, 2)).toEqual(new Uint8Array(0));
    expect(list.slice(2, 6)).toEqual(new Uint8Array([3, 4, 5, 6]));
  });

  it('slice', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const splits = [[4, 2, 3, 1], [2, 2, 2, 2, 2], [1, 6, 3, 1], [9, 2], [10], [5, 5]];

    splits.forEach(function (split) {
      const bufs = create(xs, split);
      expect(new Uint8Array(xs)).toEqual(bufs.slice());

      for (let i = 0; i < xs.length; i++) {
        for (let j = i; j < xs.length; j++) {
          const a = bufs.slice(i, j);
          const b = new Uint8Array(xs.slice(i, j));

          expect(a).toEqual(b);
        }
      }
    });
  });

  it('can splice', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

    expect(list.splice(0, 0)).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(6);
    expect(list.splice(0, 1)).toEqual({ buffers: [new Uint8Array([1])], size: 1 });
    expect(list.byteLength).toEqual(5);
    expect(list.splice(0, 2)).toEqual({ buffers: [new Uint8Array([2, 3])], size: 2 });
    expect(list.byteLength).toEqual(3);

    expect(list.splice(0, 0, new Uint8Array([1]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(4);
    expect(list.splice(0, 0, new Uint8Array([2, 3]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(6);
    expect(list.splice(0, 0, new Uint8Array([4, 5, 6]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(9);

    expect(list.buffers).toEqual([
      new Uint8Array([4, 5, 6]),
      new Uint8Array([2, 3]),
      new Uint8Array([1]),
      new Uint8Array([4, 5, 6]),
    ]);
  });

  it('splice', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const splits = [[4, 2, 3, 1], [2, 2, 2, 2, 2], [1, 6, 3, 1], [9, 2], [10], [5, 5]];

    splits.forEach(function (split) {
      for (let i = 0; i < xs.length; i++) {
        for (let j = i; j < xs.length; j++) {
          const bufs = create(xs, split);
          const xs_ = xs.slice();

          const a_ = bufs.splice(i, j);
          const a = [].slice.call(a_.slice());
          const b = xs_.splice(i, j);
          expect(a).toEqual(b);
          expect(bufs.slice()).toEqual(new Uint8Array(xs_));
        }
      }
    });
  });

  it('spliceRep', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const splits = [[4, 2, 3, 1], [2, 2, 2, 2, 2], [1, 6, 3, 1], [9, 2], [10], [5, 5]];
    const reps = [[], [1], [5, 6], [3, 1, 3, 3, 7], [9, 8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5]];

    splits.forEach(function (split) {
      reps.forEach(function (rep) {
        for (let i = 0; i < xs.length; i++) {
          for (let j = i; j < xs.length; j++) {
            const bufs = create(xs, split);
            const xs_ = xs.slice();

            const a_ = bufs.splice(i, j, new Uint8Array(rep));
            const a = [].slice.call(a_.slice());
            const b = xs_.splice(i, j, ...rep);

            expect(a).toEqual(b);
            expect(bufs.slice()).toEqual(new Uint8Array(xs_));
          }
        }
      });
    });
  });

  it('can copy', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

    const target = new Uint8Array(7);

    list.copy(target, 0);

    expect(target).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 0]));
  });

  it('other', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));
    expect(list.byteLength).toEqual(6);
    expect(list.pos(0)).toEqual({ buf: 0, offset: 0 });
    expect(list.pos(1)).toEqual({ buf: 0, offset: 1 });
    expect(list.pos(2)).toEqual({ buf: 0, offset: 2 });
    expect(list.get(0)).toEqual(1);
    expect(list.get(1)).toEqual(2);

    list.set(0, 9);
    list.set(1, 10);
    expect(list.get(0)).toEqual(9);
    expect(list.get(1)).toEqual(10);

    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const splits = [[4, 2, 3, 1], [2, 2, 2, 2, 2], [1, 6, 3, 1], [9, 2], [10], [5, 5]];

    splits.forEach(function (split) {
      const bufs = create(xs, split);
      const buf = new Uint8Array(xs);

      for (let i = 0; i < xs.length; i++) {
        for (let j = i; j < xs.length; j++) {
          const t0 = new Uint8Array(j - i);
          const t1 = new Uint8Array(j - i);

          expect(bufs.copy(t0, 0, i, j)).toEqual(copy(buf, t1, 0, i, j));
          expect([].slice.call(t0)).toEqual([].slice.call(t1));
        }
      }
    });
  });

  it('unshift', () => {
    const bufs = new Buffers();
    bufs.unshift(new Uint8Array([6, 7, 8, 9]));
    bufs.unshift(new Uint8Array([4, 5]));
    bufs.unshift(new Uint8Array([1, 2, 3]));
    bufs.unshift(new Uint8Array([0]));

    expect([].slice.call(bufs.slice())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bufs.buffers.length).toEqual(4);
    expect(bufs.byteLength).toEqual(10);
  });

  it('cursor should work', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3, 4]));
    list.push(new Uint8Array([4, 5, 6, 7, 8, 9]));
    list.push(new Uint8Array([7, 8, 9]));

    const cursor = list.cursor(0);
    let count = 0;
    for (const a of cursor.iterator()) {
      expect(a).toEqual(list.get(count));
      if (count === 4) {
        break;
      }

      count++;
    }
    expect(count).toEqual(4);
    expect(cursor.value).toEqual(list.get(5));
    expect(cursor.offset).toEqual(5);
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(1);
    expect(cursor.lineWidth).toEqual(6);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    count++;

    // reentrant
    for (const a of cursor.iterator()) {
      expect(a).toEqual(list.get(count));
      count++;
    }

    // because here we always let count plus 1
    expect(count).toEqual(list.byteLength);
    expect(cursor.offset).toEqual(list.byteLength);
    expect(cursor.line).toEqual(3);
    expect(cursor.lineOffset).toEqual(0);
  });

  it('cursor can break', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3, 4]));
    list.push(new Uint8Array([4, 5, 6, 7, 8, 9]));
    list.push(new Uint8Array([7, 8, 9]));

    const cursor = list.cursor(0);
    let count = 0;
    const iter = cursor.iterator();
    for (const a of iter) {
      expect(a).toEqual(list.get(count));
      if (count === 4) {
        iter.return();
      } else {
        count++;
      }
    }

    expect(count).toEqual(4);

    expect(cursor.offset).toEqual(5);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(1);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.skip(1);
    expect(cursor.offset).toEqual(6);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(2);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.skip(2);
    expect(cursor.offset).toEqual(8);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(4);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.skip(3);
    expect(cursor.offset).toEqual(11);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(2);
    expect(cursor.lineOffset).toEqual(1);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });
  });

  // 测试空缓冲区行为
  describe('Empty Buffer Handling', () => {
    it('should handle empty buffer operations', () => {
      const empty = new Buffers();

      expect(empty.byteLength).toBe(0);
      expect(empty.slice()).toEqual(new Uint8Array(0));
      expect(() => empty.pos(0)).toThrow('out of range');
      expect(empty.splice(0, 0)).toEqual(expect.any(Buffers));
    });
  });

  // 测试边界slice操作
  describe('Edge Case Slicing', () => {
    const buffer = create([0, 1, 2, 3, 4, 5], [3, 3]);

    it('should handle start at chunk boundary', () => {
      expect(buffer.slice(3, 5)).toEqual(new Uint8Array([3, 4]));
    });

    it('should handle end at chunk boundary', () => {
      expect(buffer.slice(2, 3)).toEqual(new Uint8Array([2]));
    });
  });
  it('should handle splice at exact chunk boundary', () => {
    const buffer = createEnhanced([0, 1, 2, 3, 4, 5], [3, 3]);
    buffer.splice(3, 2, new Uint8Array([99]));
    expect(buffer.slice()).toEqual(new Uint8Array([0, 1, 2, 99, 5]));
  });
  // 测试非法索引访问
  describe('Invalid Access Handling', () => {
    const buffer = create([1, 2, 3], [3]);

    it('should throw on negative index', () => {
      expect(() => buffer.pos(-1)).toThrow('out of range');
    });

    it('should throw on overflow index', () => {
      expect(() => buffer.pos(4)).toThrow('out of range');
    });
  });

  // 测试超大缓冲区
  describe('Large Buffer Handling', () => {
    const MB1 = new Uint8Array(1024 * 1024);
    const buffer = new Buffers();

    beforeAll(() => {
      // 填充1MB数据
      for (let i = 0; i < 1024; i++) {
        buffer.push(MB1.subarray(0, 1024));
      }
    });

    it('should handle 1GB data slicing', () => {
      const slice = buffer.slice(1024 * 512, 1024 * 512 + 100);
      expect(slice.byteLength).toBe(100);
    });
  });

  // 测试跨chunk的splice操作
  describe('Cross-Chunk Splicing', () => {
    const buffer = create([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 3, 4]);

    it('should splice across multiple chunks', () => {
      const removed = buffer.splice(2, 5, new Uint8Array([99]));

      expect(buffer.slice()).toEqual(new Uint8Array([0, 1, 99, 7, 8, 9]));
      expect(removed.slice()).toEqual(new Uint8Array([2, 3, 4, 5, 6]));
    });
  });

  // 测试slice4特殊方法
  describe('slice4 Special Cases', () => {
    it('should handle partial slice4', () => {
      const buffer = create([1, 2, 3], [3]);
      expect(buffer.slice4(2)).toEqual(new Uint8Array([3, 0, 0, 0]));
    });

    it('should handle edge slice4', () => {
      const buffer = create([1, 2, 3, 4, 5], [5]);
      expect(buffer.slice4(1)).toEqual(new Uint8Array([2, 3, 4, 5]));
    });
  });

  // 测试Cursor高级功能
  describe('Cursor Advanced Operations', () => {
    const buffer = create([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 3, 4]);

    it('should handle moveTo across chunks', () => {
      const cursor = buffer.cursor();
      cursor.moveTo(5);
      expect(cursor.line).toBe(1);
      expect(cursor.lineOffset).toBe(2);
    });

    it('should reset correctly', () => {
      const cursor = buffer.cursor(5);
      cursor.reset();
      expect(cursor.offset).toBe(0);
      expect(cursor.line).toBe(0);
    });
  });

  // 测试Dispose行为
  describe('Resource Management', () => {
    it('should clear resources on dispose', () => {
      const buffer = create([1, 2, 3], [3]);
      buffer.dispose();

      expect(buffer.buffers).toEqual([]);
      expect(buffer.byteLength).toBe(0);
    });
  });

  // 性能测试
  describe('Performance Tests', () => {
    let largeBuffer: Buffers;

    beforeAll(() => {
      largeBuffer = new Buffers();
      // 创建包含1000个10KB chunk的缓冲区
      for (let i = 0; i < 1000; i++) {
        largeBuffer.push(new Uint8Array(10 * 1024));
      }
    });

    it('should handle slicing 1MB data under 50ms', () => {
      const start = performance.now();
      const slice = largeBuffer.slice(0, 1024 * 1024);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(slice.byteLength).toBe(1024 * 1024);
    });

    it('should handle 1000 splices under 1s', () => {
      const buf = createEnhanced(
        new Array(10000).fill(0).map((_, i) => i),
        [100, 900, 9000],
      );

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        buf.splice(i % 100, 5, new Uint8Array([i]));
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});

function create(xs: number[], split: number[]) {
  const bufs = new Buffers();
  let offset = 0;
  split.forEach(function (i) {
    bufs.push(new Uint8Array(xs.slice(offset, offset + i)));
    offset += i;
  });
  return bufs;
}

function createEnhanced(xs: number[], split: number[]): Buffers {
  const bufs = new Buffers();
  let offset = 0;
  split.forEach((chunkSize) => {
    if (chunkSize > 0) {
      const chunk = new Uint8Array(xs.slice(offset, offset + chunkSize));
      bufs.push(chunk);
      offset += chunkSize;
    }
  });
  return bufs;
}
