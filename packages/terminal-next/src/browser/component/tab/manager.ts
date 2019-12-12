import { observable } from 'mobx';
import { Injectable } from '@ali/common-di';
import { Emitter, Event, uuid } from '@ali/ide-core-common';

export class TabItemInfo {
  private _id = uuid();
  private _name: string;

  constructor(name: string) {
    this._name = name;
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
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

  constructor() {
    this.items = observable.array([]);
    this.state = observable.object({
      current: -1,
    });
  }

  get current() {
    if (this.state.current === -1) {
      return null;
    }
    return this.items[this.state.current];
  }

  firstInitialize() {
    this.create('first');
  }

  create(name: string, selected: boolean = false): TabItemInfo {

    const item = new TabItemInfo(name);
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

  select(index: number): TabItemInfo {
    const item = this.items[index];
    this.state.current = index;

    this._onSelect.fire({ item, index });

    return item;
  }

  private _onOpen = new Emitter<TabEvent>();
  onOpen: Event<TabEvent> = this._onOpen.event;

  private _onSelect = new Emitter<TabEvent>();
  onSelect: Event<TabEvent> = this._onSelect.event;

  private _onClose = new Emitter<TabEvent>();
  onClose: Event<TabEvent> = this._onClose.event;
}
