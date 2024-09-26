import extend from 'lodash/extend';

import { Injectable, Optional } from '@opensumi/di';
import { EventEmitter } from '@opensumi/events';

import { select } from './select';

export interface DataStore<Item> {
  create(item: Item): Item;
  find(query: Record<string, any>): Item[] | undefined;
  size(query: Record<string, any>): number;
  get(id: string, query?: Record<string, any>): Item | undefined;
  update(id: string, item: Partial<Item>): void;
  remove(id: string): void;
}

export interface DataStoreEvent<Item> extends Record<string, any> {
  created: [Item];
  updated: [oldValue: Item, newValue: Item];
  removed: [Item];
}

export interface DataStoreOptions {
  id?: string;
}

export class InMemoryDataStore<Item> extends EventEmitter<DataStoreEvent<Item>> implements DataStore<Item> {
  private store = new Map<string, Item>();
  private _uId = 0;
  private id: string;

  constructor(protected options?: DataStoreOptions) {
    super();
    this.id = options?.id || 'id';
  }

  create(item: Item): Item {
    const id = item[this.id] || String(this._uId++);
    const result = extend({}, item, { [this.id]: id }) as Item;

    this.store.set(id, result);

    this.emit('created', result);
    return result;
  }

  find(query: Record<string, any>): Item[] | undefined {
    return select(this.store, query);
  }

  size(query?: Record<string, any>): number {
    if (!query) {
      return this.store.size;
    }

    return this.find(query)?.length || 0;
  }

  get(id: string): Item | undefined {
    return this.store.get(id);
  }

  has(id: string): boolean {
    return this.store.has(id);
  }

  update(id: string, item: Partial<Item>): void {
    const current = this.store.get(id);
    if (!current) {
      return;
    }

    const result = extend({}, current, item);
    this.emit('updated', current, result);

    this.store.set(id, result);
  }

  remove(id: string): void {
    const item = this.store.get(id);
    if (item) {
      this.emit('removed', item);
    }

    this.store.delete(id);
  }
}
