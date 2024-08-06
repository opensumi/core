/**
 * 大小堆（优先队列）
 */

/**
 * return a negative value if a < b, 0 if a == b, a positive value if a > b
 */
export type Comparator<K> = (a: K, b: K) => number;

interface HeapOptions<T> {
  /**
   * A function that defines the sort order. The return value should be a number whose sign
   * indicates the relative order of the two elements: negative if a is less than b,
   * positive if a is greater than b, and zero if they are equal.
   * NaN is treated as 0.
   */
  comparator: Comparator<T>;
}

export class Heap<T> {
  private readonly elements: Array<T> = [];

  // 堆元素数量
  size: number = 0;

  private cmp: Comparator<T>;

  constructor(options: HeapOptions<T>) {
    this.cmp = options.comparator;
  }

  peek(): T {
    return this.elements[0];
  }

  pop(): T | undefined {
    if (this.elements.length === 0) {
      return undefined;
    }
    if (this.elements.length === 1) {
      this.size--;
      return this.elements.pop();
    }

    const res = this.elements[0];
    this.elements[0] = this.elements.pop()!;
    this.size--;

    // 维护最大堆的特性：下沉操作
    this._sink(0);

    return res;
  }

  add(data: T): void {
    this.elements.push(data);
    this.size++;

    this._float();
  }

  toArray(): Array<T> {
    return this.elements.slice(0, this.size);
  }

  private _float(): void {
    let idx: number = this.size - 1;

    let p: number;
    while (idx > 0) {
      // 获取父节点索引
      p = (idx - 1) >> 1;

      if (this.cmp(this.elements[p], this.elements[idx]) <= 0) {
        break;
      }

      this.swap(p, idx);
      idx = p;
    }
  }

  private _sink(start: number): void {
    const halfLength: number = this.size >> 1;

    while (start < halfLength) {
      const l: number = (start << 1) | 1;
      const r: number = l + 1;

      const minIdx: number = r < this.size && this.cmp(this.elements[r], this.elements[l]) < 0 ? r : l;

      if (this.cmp(this.elements[minIdx], this.elements[start]) >= 0) {
        break;
      }

      this.swap(start, minIdx);
      start = minIdx;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.elements[i];
    this.elements[i] = this.elements[j];
    this.elements[j] = tmp;
  }
}
