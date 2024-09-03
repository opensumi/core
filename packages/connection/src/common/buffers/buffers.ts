/**
 * Treat a collection of Buffers as a single contiguous partially mutable Buffer.
 *
 * Where possible, operations execute without creating a new Buffer and copying everything over.
 */

export const emptyBuffer = new Uint8Array(0);
export const buffer4Capacity = new Uint8Array(4);

export function copy(
  source: Uint8Array,
  target: Uint8Array,
  targetStart?: number,
  sourceStart?: number,
  sourceEnd?: number,
) {
  target.set(source.subarray(sourceStart, sourceEnd), targetStart);
}

export class Buffers {
  buffers = [] as Uint8Array[];
  protected size = 0;

  get byteLength() {
    return this.size;
  }

  push(buffer: Uint8Array) {
    this.buffers.push(buffer);
    this.size += buffer.length;
  }

  unshift(buffer: Uint8Array) {
    this.buffers.unshift(buffer);
    this.size += buffer.length;
  }

  slice(start?: number, end?: number) {
    const buffers = this.buffers;
    if (end === undefined) {
      end = this.size;
    }
    if (start === undefined) {
      start = 0;
    }

    if (end > this.size) {
      end = this.size;
    }

    if (start >= end) {
      return emptyBuffer;
    }

    let startBytes = 0;
    let si = 0;
    for (; si < buffers.length && startBytes + buffers[si].length <= start; si++) {
      startBytes += buffers[si].length;
    }

    const target = new Uint8Array(end - start);

    let ti = 0;
    for (let ii = si; ti < end - start && ii < buffers.length; ii++) {
      const len = buffers[ii].length;

      const _start = ti === 0 ? start - startBytes : 0;
      const _end = ti + len >= end - start ? Math.min(_start + (end - start) - ti, len) : len;
      copy(buffers[ii], target, ti, _start, _end);
      ti += _end - _start;
    }

    return target;
  }

  slice4(start: number) {
    let end = start + 4;
    const buffers = this.buffers;

    if (end > this.size) {
      end = this.size;
    }

    if (start >= end) {
      return emptyBuffer;
    }

    let startBytes = 0;
    let si = 0;
    for (; si < buffers.length && startBytes + buffers[si].length <= start; si++) {
      startBytes += buffers[si].length;
    }

    const target = buffer4Capacity;

    let ti = 0;
    for (let ii = si; ti < end - start && ii < buffers.length; ii++) {
      const len = buffers[ii].length;

      const _start = ti === 0 ? start - startBytes : 0;
      const _end = ti + len >= end - start ? Math.min(_start + (end - start) - ti, len) : len;
      copy(buffers[ii], target, ti, _start, _end);
      ti += _end - _start;
    }

    return target;
  }

  pos(i: number): { buf: number; offset: number } {
    if (i < 0 || i >= this.size) {
      throw new Error(`out of range, ${i} not in [0, ${this.size})`);
    }
    let l = i;
    let bi = 0;
    let bu: Uint8Array | null = null;
    for (;;) {
      bu = this.buffers[bi];
      if (l < bu.length) {
        return { buf: bi, offset: l };
      } else {
        l -= bu.length;
      }
      bi++;
    }
  }

  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.size) {
    return copy(this.slice(sourceStart, sourceEnd), target, targetStart, 0, sourceEnd - sourceStart);
  }

  splice(start: number, deleteCount: number, ...reps: Uint8Array[]) {
    const buffers = this.buffers;
    const index = start >= 0 ? start : this.size - start;

    if (deleteCount === undefined) {
      deleteCount = this.size - index;
    } else if (deleteCount > this.size - index) {
      deleteCount = this.size - index;
    }

    for (const i of reps) {
      this.size += i.length;
    }

    const removed = new Buffers();

    let startBytes = 0;
    let ii = 0;
    for (; ii < buffers.length && startBytes + buffers[ii].length < index; ii++) {
      startBytes += buffers[ii].length;
    }

    if (index - startBytes > 0) {
      const start = index - startBytes;

      if (start + deleteCount < buffers[ii].length) {
        removed.push(buffers[ii].slice(start, start + deleteCount));

        const orig = buffers[ii];
        const buf0 = new Uint8Array(start);
        for (let i = 0; i < start; i++) {
          buf0[i] = orig[i];
        }

        const buf1 = new Uint8Array(orig.length - start - deleteCount);
        for (let i = start + deleteCount; i < orig.length; i++) {
          buf1[i - deleteCount - start] = orig[i];
        }

        if (reps.length > 0) {
          const reps_ = reps.slice();
          reps_.unshift(buf0);
          reps_.push(buf1);
          buffers.splice.apply(buffers, [ii, 1, ...reps_]);
          ii += reps_.length;
          reps = [];
        } else {
          buffers.splice(ii, 1, buf0, buf1);
          ii += 2;
        }
      } else {
        removed.push(buffers[ii].slice(start));
        buffers[ii] = buffers[ii].slice(0, start);
        ii++;
      }
    }

    if (reps.length > 0) {
      buffers.splice.apply(buffers, [ii, 0, ...reps]);
      ii += reps.length;
    }

    while (removed.byteLength < deleteCount) {
      const buf = buffers[ii];
      const len = buf.length;
      const take = Math.min(len, deleteCount - removed.byteLength);

      if (take === len) {
        removed.push(buf);
        buffers.splice(ii, 1);
      } else {
        removed.push(buf.slice(0, take));
        buffers[ii] = buffers[ii].slice(take);
      }
    }

    this.size -= removed.byteLength;

    return removed;
  }

  get(i: number) {
    const { buf, offset } = this.pos(i);
    return this.buffers[buf][offset];
  }

  set(i: number, v: number) {
    const { buf, offset } = this.pos(i);
    this.buffers[buf][offset] = v;
  }

  cursor(offset = 0) {
    return new Cursor(this, offset);
  }

  dispose() {
    this.buffers = [];
    this.size = 0;
  }
}

/**
 * Remember the current position in a Buffers.
 *
 * The cursor will always point to the next byte to be read.
 *
 * The cursor is not safe to use after the Buffers is modified.
 */
export class Cursor {
  protected chunkIndex = 0;
  protected chunkOffset = 0;

  constructor(protected buffers: Buffers, public offset = 0) {
    this.updatePosition();
  }

  protected updatePosition() {
    if (this.offset === 0) {
      this.chunkIndex = 0;
      this.chunkOffset = 0;
      return;
    }

    const { buf, offset } = this.buffers.pos(this.offset);
    this.chunkIndex = buf;
    this.chunkOffset = offset;
  }

  /**
   * Return this cursor's current line number.
   */
  get line() {
    return this.chunkIndex;
  }

  get lineWidth() {
    return this.buffers.buffers[this.chunkIndex].byteLength;
  }

  get value() {
    return this.buffers.buffers[this.chunkIndex][this.chunkOffset];
  }

  /**
   * Return the cursor offset in the current line.
   */
  get lineOffset() {
    return this.chunkOffset;
  }

  *iterator() {
    while (this.chunkIndex < this.buffers.buffers.length) {
      const chunk = this.buffers.buffers[this.chunkIndex];
      const chunkLength = chunk.byteLength;

      while (this.chunkOffset < chunkLength) {
        const num = chunk[this.chunkOffset];
        this.chunkOffset++;
        this.offset++;

        yield num;
      }
      this.chunkOffset = 0;
      this.chunkIndex++;
    }
  }

  read(n: number) {
    const end = this.offset + n;
    const buffers = this.buffers.slice(this.offset, end);
    this.skip(n);
    return buffers;
  }

  read4() {
    const buffers = this.buffers.slice4(this.offset);
    this.skip(4);
    return buffers;
  }

  skip(n: number) {
    let count = 0;
    while (this.chunkIndex < this.buffers.buffers.length) {
      const chunk = this.buffers.buffers[this.chunkIndex];
      const chunkLength = chunk.byteLength;

      while (this.chunkOffset < chunkLength) {
        this.chunkOffset++;
        this.offset++;

        if (++count === n) {
          return;
        }
      }
      this.chunkOffset = 0;
      this.chunkIndex++;
    }
  }

  moveTo(n: number) {
    this.offset = n;
    this.updatePosition();
  }

  dispose() {
    this.buffers = null as any;
    this.offset = 0;
  }

  reset() {
    this.offset = 0;
    this.chunkIndex = 0;
    this.chunkOffset = 0;
  }
}
