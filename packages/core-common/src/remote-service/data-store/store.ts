import extend from 'lodash/extend';

import { EventEmitter } from '@opensumi/events';

import { select } from './select';

export type Query = Record<string, any>;

export interface DataStoreEvent<Item> {
  created: [item: Item];
  updated: [oldItem: Item, newItem: Item];
  removed: [item: Item];

  [key: string]: any[];
}

export interface DataStoreOptions {
  id?: string;
}

export class InMemoryDataStore<
  Item extends Record<any, any>,
  PrimaryKey extends keyof Item,
  PrimaryKeyType = Item[PrimaryKey],
> extends EventEmitter<DataStoreEvent<Item>> {
  private store = new Map<PrimaryKeyType, Item>();
  private _uid = 0;
  /**
   * primary key
   */
  private id: string;

  constructor(protected options?: DataStoreOptions) {
    super();
    this.id = options?.id || 'id';
  }

  create(item: Item): Item {
    const id = item[this.id] || this._uid++;
    const result = extend({}, item, { [this.id]: id }) as Item;

    this.store.set(id, result);

    this.emit('created', result);
    return result;
  }

  find(query?: Query): Item[] | undefined {
    if (!query) {
      return Array.from(this.store.values());
    }
    return select(this.store, query);
  }

  count(query?: Query): number {
    if (!query) {
      return this.store.size;
    }

    return this.find(query)?.length || 0;
  }

  get(id: PrimaryKeyType): Item | undefined {
    return this.store.get(id);
  }

  has(id: PrimaryKeyType): boolean {
    return this.store.has(id);
  }

  update(id: PrimaryKeyType, item: Partial<Item>): void {
    const current = this.store.get(id);
    if (!current) {
      return;
    }

    const result = extend({}, current, item);
    this.emit('updated', current, result);

    this.store.set(id, result);
  }

  remove(id: PrimaryKeyType): void {
    const item = this.store.get(id);
    if (item) {
      this.emit('removed', item);
    }

    this.store.delete(id);
  }

  removeItem(item: Item): void {
    const id = item[this.id] as PrimaryKeyType;
    this.remove(id);
  }

  removeAll(query?: Query): void {
    if (!query) {
      this.store.forEach((item, key) => {
        this.emit('removed', item);
        this.store.delete(key);
      });
      return;
    }

    const items = this.find(query);
    if (items) {
      items.forEach((item) => {
        this.emit('removed', item);
        this.store.delete(item[this.id]);
      });
    }
  }
}
