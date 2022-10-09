import { Event } from '@opensumi/ide-core-common';

import type {
  IToolbarButtonContribution,
  IToolbarDropdownButtonContribution,
  IToolbarSelectContribution,
  // eslint-disable-next-line import/no-restricted-paths
} from '../../browser/sumi/types';

export interface IToolbarButtonActionHandle {
  onClick: Event<void>;

  setState(state: string, title?: string): Promise<void>;

  onStateChanged: Event<{ from: string; to: string }>;

  showPopover(): Promise<void>;

  hidePopover(): Promise<void>;

  setContext(context: any): void;
}

export interface IToolbarSelectActionHandle<T> {
  setState(state: string): Promise<void>;

  setOptions(
    options: {
      iconPath?: string;
      iconMaskMode?: boolean;
      label?: string;
      value: T;
    }[],
  ): void;

  onSelect: Event<T>;

  onStateChanged: Event<{ from: string; to: string }>;

  setSelect(value: T): Promise<void>;

  getValue(): T;
}

export interface IToolbarDropdownButtonActionHandle<T> {
  onSelect: Event<T>;
}

export interface IMainThreadToolbar {
  $registerToolbarButtonAction(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution,
  ): Promise<void>;

  $registerToolbarSelectAction<T = any>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarSelectContribution<T>,
  ): Promise<void>;

  $registerDropdownButtonAction<T = any>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarDropdownButtonContribution<T>,
  ): Promise<void>;
}

export interface IExtHostToolbar {
  registerToolbarAction<T>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution | IToolbarSelectContribution | IToolbarDropdownButtonContribution,
  ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T> | IToolbarDropdownButtonActionHandle<T>>;

  getToolbarButtonActionHandle(id: string, extensionId: string): Promise<IToolbarButtonActionHandle>;

  getToolbarSelectActionHandle<T = any>(id: string, extensionId: string): Promise<IToolbarSelectActionHandle<T>>;
}
