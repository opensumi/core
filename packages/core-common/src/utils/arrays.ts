import { IDisposable } from '../disposable';
import { Emitter, Event } from '../event';
import { ISplice } from '../sequence';

export function isNonEmptyArray<T>(obj: ReadonlyArray<T> | undefined | null): obj is Array<T> {
  return Array.isArray(obj) && obj.length > 0;
}
/**
 * 移除给定数组中的重复值
 * keyFn函数支持指定校验逻辑
 */
export function distinct<T>(array: ReadonlyArray<T>, keyFn?: (t: T) => string): T[] {
  if (!keyFn) {
    return array.filter((element, position) => array.indexOf(element) === position);
  }

  const seen: { [key: string]: boolean } = Object.create(null);
  return array.filter((elem) => {
    const key = keyFn(elem);
    if (seen[key]) {
      return false;
    }

    seen[key] = true;

    return true;
  });
}

interface IMutableSplice<T> extends ISplice<T> {
  deleteCount: number;
}

/**
 * Diffs two *sorted* arrays and computes the splices which apply the diff.
 */
export function sortedDiff<T>(
  before: ReadonlyArray<T>,
  after: ReadonlyArray<T>,
  compare: (a: T, b: T) => number,
): ISplice<T>[] {
  const result: IMutableSplice<T>[] = [];

  function pushSplice(start: number, deleteCount: number, toInsert: T[]): void {
    if (deleteCount === 0 && toInsert.length === 0) {
      return;
    }

    const latest = result[result.length - 1];

    if (latest && latest.start + latest.deleteCount === start) {
      latest.deleteCount += deleteCount;
      latest.toInsert.push(...toInsert);
    } else {
      result.push({ start, deleteCount, toInsert });
    }
  }

  let beforeIdx = 0;
  let afterIdx = 0;

  while (true) {
    if (beforeIdx === before.length) {
      pushSplice(beforeIdx, 0, after.slice(afterIdx));
      break;
    }
    if (afterIdx === after.length) {
      pushSplice(beforeIdx, before.length - beforeIdx, []);
      break;
    }

    const beforeElement = before[beforeIdx];
    const afterElement = after[afterIdx];
    const n = compare(beforeElement, afterElement);
    if (n === 0) {
      // equal
      beforeIdx += 1;
      afterIdx += 1;
    } else if (n < 0) {
      // beforeElement is smaller -> before element removed
      pushSplice(beforeIdx, 1, []);
      beforeIdx += 1;
    } else if (n > 0) {
      // beforeElement is greater -> after element added
      pushSplice(beforeIdx, 0, [afterElement]);
      afterIdx += 1;
    }
  }

  return result;
}

export function equals<T>(
  one: ReadonlyArray<T> | undefined,
  other: ReadonlyArray<T> | undefined,
  itemEquals: (a: T, b: T) => boolean = (a, b) => a === b,
): boolean {
  if (one === other) {
    return true;
  }

  if (!one || !other) {
    return false;
  }

  if (one.length !== other.length) {
    return false;
  }

  for (let i = 0, len = one.length; i < len; i++) {
    if (!itemEquals(one[i], other[i])) {
      return false;
    }
  }

  return true;
}

export function asArray<T>(x: T | T[]): T[];
export function asArray<T>(x: T | readonly T[]): readonly T[];
export function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

/**
 * 获取非空数组
 * @param array
 */
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
  return array.filter((e) => !!e) as T[];
}

export function addElement<T>(array: Array<T>, element: T, unshift = false): IDisposable {
  if (unshift) {
    array.unshift(element);
  } else {
    array.push(element);
  }
  return {
    dispose: () => {
      const index = array.indexOf(element);
      if (index !== -1) {
        array.splice(index, 1);
      }
    },
  };
}

export function addMapElement<K, T>(map: Map<K, T>, key: K, element: T): IDisposable {
  map.set(key, element);
  return {
    dispose: () => {
      if (map.get(key) === element) {
        map.delete(key);
      }
    },
  };
}

export interface ILRULinkListNode<K> {
  key: K | undefined;
  next: ILRULinkListNode<K> | undefined;
  prev: ILRULinkListNode<K> | undefined;
}

/**
 * 自带LRU清理的Map
 * 双向链表 + Map
 */
export class LRUMap<K, V> extends Map<K, V> {
  private _onDidDelete = new Emitter<{ key: K; value: V }>();

  public readonly onDidDelete: Event<{ key: K; value: V }> = this._onDidDelete.event;

  private head: ILRULinkListNode<K> = { key: undefined, prev: undefined, next: undefined };

  private tail: ILRULinkListNode<K> = { key: undefined, prev: undefined, next: undefined };

  private map: Map<K, ILRULinkListNode<K>> = new Map();

  constructor(private hardLimit: number, private softLimit: number) {
    super();
    if (hardLimit <= softLimit) {
      throw new Error('hardLimit 必须比 softLimit大');
    }
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  private markRecentUsed(key: K) {
    if (!this.map.get(key)) {
      this.map.set(key, { key, prev: undefined, next: undefined });
    }
    this.putHead(this.map.get(key)!);
  }

  get(key: K): V | undefined {
    const v = super.get(key);
    if (v) {
      this.markRecentUsed(key);
    }
    return v;
  }

  set(key: K, value: V): this {
    this.markRecentUsed(key);
    super.set(key, value);
    if (this.size > this.hardLimit) {
      this.shrink();
    }
    return this;
  }

  putHead(node: ILRULinkListNode<K>) {
    this.deleteNodeFromList(node);
    const lastHead = this.head.next;
    this.head.next = node;
    node.next = lastHead;
    node.prev = undefined;
    if (lastHead) {
      lastHead.prev = node;
    }
  }

  protected deleteNodeFromList(node: ILRULinkListNode<K>) {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }

  delete(key: K) {
    const node = this.map.get(key);
    if (node) {
      this.deleteNodeFromList(node);
    }
    const value = super.get(key);
    this._onDidDelete.fire({
      key,
      value: value!,
    });
    return super.delete(key);
  }

  shrink() {
    const toDelete = this.size - this.softLimit;
    let toDeleteNode: ILRULinkListNode<K> = this.tail;
    for (let i = 0; i < toDelete; i++) {
      toDeleteNode = this.tail.prev!;
      if (!toDeleteNode || toDeleteNode === this.head) {
        break;
      } else {
        this.delete(toDeleteNode.key!);
      }
    }
  }
}

const NOW = Symbol('now');
/**
 * 支持过期时间
 */
export class StaleLRUMap<K, V> extends LRUMap<K, V> {
  constructor(hardLimit: number, softLimit: number, private maxAge: number) {
    super(hardLimit, softLimit);
  }

  get(key: K): V | undefined {
    const v = super.get(key);
    if (v) {
      if (!this._isStale(v)) {
        return v;
      }
      // 过期则删除该条记录
      this.delete(key);
    }
    return undefined;
  }

  set(key: K, value: V): this {
    value[NOW] = Date.now();
    return super.set(key, value);
  }

  private _isStale(value: V): boolean {
    return value[NOW] + this.maxAge <= Date.now();
  }
}

type NonFunctional<T> = T extends Function ? never : T;

// 枚举 value 转数组值
export function enumValueToArray<T>(enumeration: T): NonFunctional<T[keyof T]>[] {
  return Object.keys(enumeration)
    .filter((key) => isNaN(Number(key)))
    .map((key) => enumeration[key])
    .filter((val) => typeof val === 'number' || typeof val === 'string');
}
