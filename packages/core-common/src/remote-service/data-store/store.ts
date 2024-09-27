import extend from 'lodash/extend';

import { EventEmitter } from '@opensumi/events';

import { select } from './select';

export type Query = Record<string, any>;

export interface DataStore<Item, PrimaryKey = string> {
  create(item: Item): Item;
  find(query: Query): Item[] | undefined;
  size(query: Query): number;
  has(id: PrimaryKey): boolean;
  get(id: PrimaryKey, query?: Query): Item | undefined;
  update(id: PrimaryKey, item: Partial<Item>): void;

  remove(id: PrimaryKey): void;
  removeItem(item: Item): void;
  removeAll(query?: Query): void;
}

export interface DataStoreEvent<Item> extends Record<string, any> {
  created: [item: Item];
  updated: [oldItem: Item, newItem: Item];
  removed: [item: Item];
}

export interface DataStoreOptions {
  id?: string;
}

export class InMemoryDataStore<Item, PrimaryKey = number>
  extends EventEmitter<DataStoreEvent<Item>>
  implements DataStore<Item, PrimaryKey>
{
  private store = new Map<PrimaryKey, Item>();
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

  find(query: Query): Item[] | undefined {
    return select(this.store, query);
  }

  size(query?: Query): number {
    if (!query) {
      return this.store.size;
    }

    return this.find(query)?.length || 0;
  }

  get(id: PrimaryKey): Item | undefined {
    return this.store.get(id);
  }

  has(id: PrimaryKey): boolean {
    return this.store.has(id);
  }

  update(id: PrimaryKey, item: Partial<Item>): void {
    const current = this.store.get(id);
    if (!current) {
      return;
    }

    const result = extend({}, current, item);
    this.emit('updated', current, result);

    this.store.set(id, result);
  }

  remove(id: PrimaryKey): void {
    const item = this.store.get(id);
    if (item) {
      this.emit('removed', item);
    }

    this.store.delete(id);
  }

  removeItem(item: Item): void {
    const id = item[this.id] as PrimaryKey;
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
