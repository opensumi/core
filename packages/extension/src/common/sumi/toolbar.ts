import { Event } from '@opensumi/ide-core-common';

// eslint-disable-next-line import/no-restricted-paths
import type { IToolbarButtonContribution, IToolbarSelectContribution } from '../../browser/sumi/types';

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
}

export interface IExtHostToolbar {
  registerToolbarAction<T>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution | IToolbarSelectContribution,
  ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T>>;

  getToolbarButtonActionHandle(id: string, extensionId: string): Promise<IToolbarButtonActionHandle>;

  getToolbarSelectActionHandle<T = any>(id: string, extensionId: string): Promise<IToolbarSelectActionHandle<T>>;
}
