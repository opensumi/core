import React from 'react';

import { Event, MayCancelablePromise, MessageType, URI } from '@opensumi/ide-core-common';

import type vscode from 'vscode';

export const IMessageService = Symbol('IMessageService');

export interface OpenMessageOptions {
  message: string | React.ReactNode;
  type: MessageType;
  buttons?: any[];
  options?: vscode.MessageOptions;
  closable?: boolean;
  from?: string;
  props?: Record<string, any>;
}
export interface IMessageService {
  info(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): MayCancelablePromise<string | undefined>;
  warning(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): MayCancelablePromise<string | undefined>;
  error(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): MayCancelablePromise<string | undefined>;
  open<T = string>(options: OpenMessageOptions): MayCancelablePromise<T | undefined>;
  hide<T = string>(value?: T): void;
}

export interface Icon {
  color: string;
  className: string;
}

export const MAX_MESSAGE_LENGTH = 1000;

export const IDialogService = Symbol('IDialogService');
export interface IDialogService extends IMessageService {
  closable?: boolean;
  visible: boolean;
  onDidDialogVisibleChange: Event<boolean>;
  getMessage(): string | React.ReactNode;
  getDetail(): string | undefined;
  getIcon(): Icon | undefined;
  getButtons(): string[] | undefined;
  getType(): MessageType | undefined;
  getProps(): Record<string, any>;
  reset(): void;
}

export abstract class AbstractMessageService implements IMessageService {
  info(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): Promise<string | undefined> {
    return this.open({ message, type: MessageType.Info, buttons, closable, props });
  }

  warning(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): Promise<string | undefined> {
    return this.open({ message, type: MessageType.Warning, buttons, closable, props });
  }

  error(
    message: string | React.ReactNode,
    buttons?: string[],
    closable?: boolean,
    props?: Record<string, any>,
  ): Promise<string | undefined> {
    return this.open({ message, type: MessageType.Error, buttons, closable, props });
  }
  abstract open<T = string>(options: OpenMessageOptions): Promise<T | undefined>;
  abstract hide<T = string>(value?: T): void;
}

export interface IWindowDialogService {
  showOpenDialog(options?: IOpenDialogOptions): Promise<URI[] | undefined>;
  showSaveDialog(options?: ISaveDialogOptions & { saveAs?: boolean }): Promise<URI | undefined>;
}

export const IWindowDialogService = Symbol('IWindowDialogService');

export interface IDialogOptions {
  title?: string;
  defaultUri?: URI;
  filters?: {
    [name: string]: string[];
  };
}

export interface ISaveDialogOptions extends IDialogOptions {
  saveLabel?: string;
  showNameInput?: boolean;
  defaultFileName?: string;
}

export interface IOpenDialogOptions extends IDialogOptions {
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  openLabel?: string;
}

export namespace ISaveDialogOptions {
  export function is(option) {
    return 'saveLabel' in option || 'showNameInput' in option || 'defaultFileName' in option;
  }
}

export namespace IOpenDialogOptions {
  export function is(option) {
    return (
      'canSelectFiles' in option || 'canSelectFolders' in option || 'canSelectMany' in option || 'openLabel' in option
    );
  }
}
