import { Event } from '@ali/ide-core-common';

export interface IToolbarButtonActionHandle {

  onClick: Event<void>;

  setState(state: string, title?: string): Promise<void>;

  onStateChanged: Event<{from: string, to: string}>;

  showPopover(): Promise<void>;
}

export interface IToolbarSelectActionHandle<T> {

  setState(state: string): Promise<void>;

  setOptions(options: {
    iconPath?: string,
    iconMaskMode?: boolean,
    label?: string,
    value: T,
  }[]): void;

  onSelect: Event<T>;

  onStateChanged: Event<{from: string, to: string}>;

  setSelect(value: T): Promise<void>;

  getValue(): T;
}
