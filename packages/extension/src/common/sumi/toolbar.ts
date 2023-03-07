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

export enum TOOLBAR_ACTION_TYPE {
  BUTTON = 'button',
  DROPDOWN_BUTTON = 'dropdownButton',
  SELECT = 'select',
}

const EXTENSION_TOOLBAR_ACTION_PREFIX = 'sumi-extension.toolbar';

export const BUTTON_SET_STATE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.btn.setState`;
export const BUTTON_STATE_CHANGE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.btn.stateChange`;
export const BUTTON_SET_CONTEXT_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.btn.setContext`;
export const BUTTON_CONNECT_HANDLE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.btn.connectHandle`;
export const BUTTON_CLICK_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.btn.click`;
export const SHOW_POPOVER_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.showPopover`;
export const HIDE_POPOVER_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.hidePopover`;
export const SELECT_SET_STATE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.setState`;
export const SELECT_SET_OPTIONS = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.setOptions`;
export const SELECT_SET_SELECT_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.setSelect`;
export const SELECT_CONNECT_HANDLE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.connectHandle`;
export const SELECT_ON_SELECT_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.onSelect`;
export const SELECT_STATE_CHANGE_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.select.stateChange`;
export const DROPDOWN_BUTTON_ON_SELECT_ID = `${EXTENSION_TOOLBAR_ACTION_PREFIX}.dropdownButton.onSelect`;
