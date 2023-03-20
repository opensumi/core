import { Emitter, Event } from './event';

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
  public readonly onKeyDidDelete = (key: K, ...args: Parameters<Event<{ key: K; value: V }>>) =>
    Event.filter(this.onDidDelete, (e) => e.key === key)(...args);

  private head: ILRULinkListNode<K> = { key: undefined, prev: undefined, next: undefined };

  private tail: ILRULinkListNode<K> = { key: undefined, prev: undefined, next: undefined };

  private map: Map<K, ILRULinkListNode<K>> = new Map();

  constructor(private hardLimit: number, private softLimit: number) {
    super();
    if (hardLimit < softLimit) {
      throw new Error('hardLimit must be greater equal than softLimit.');
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
