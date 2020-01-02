import { observable } from 'mobx';
import { Injectable } from '@ali/common-di';
import { Emitter, Event, uuid } from '@ali/ide-core-common';

export class TabItemInfo {
  private _id = uuid();

  private _name = '';

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  constructor(name = '') {
    this._name = name;
  }
}

export interface TabEvent {
  item: TabItemInfo;
  index: number;
}

@Injectable()
export class TabManager {
  @observable
  items: TabItemInfo[];

  @observable
  state: { current: number };

  @observable
  editable: Set<string>;

  constructor() {
    this.clear();
  }

  get current() {
    if (this.state.current === -1) {
      return null;
    }
    return this.items[this.state.current];
  }

  create(selected: boolean = false): TabItemInfo {

    const item = new TabItemInfo();
    const length = this.items.push(item);

    if (selected) {
      this.select(this.items.length - 1);
    }

    this._onOpen.fire({ item, index: length - 1 });

    return item;
  }

  remove(index: number): TabItemInfo {
    const [item] = this.items.splice(index, 1);

    this._onClose.fire({ item, index });

    return item;
  }

  clear() {
    this.items = observable.array([]);
    this.editable = observable.set(new Set());
    this.state = observable.object({
      current: -1,
    });
  }

  select(index: number): TabItemInfo {
    const item = this.items[index];
    this.state.current = index;

    this._onSelect.fire({ item, index });

    return item;
  }

  addEditable(id: string) {
    this.editable.add(id);
  }

  delEditable(id: string) {
    this.editable.delete(id);
  }

  rename(id: string, index: number, name: string) {
    const item = this.items[index];

    this.delEditable(id);
    if (item) {
      this.items.splice(index, 1, new TabItemInfo(name));
    }
  }

  private _onOpen = new Emitter<TabEvent>();
  onOpen: Event<TabEvent> = this._onOpen.event;

  private _onSelect = new Emitter<TabEvent>();
  onSelect: Event<TabEvent> = this._onSelect.event;

  private _onClose = new Emitter<TabEvent>();
  onClose: Event<TabEvent> = this._onClose.event;
}
