import React from 'react';

import { MessageType, URI } from '@opensumi/ide-core-common';

export const IMessageService = Symbol('IMessageService');

export interface IMessageService {
  info(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  warning(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  error(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined>;
  open<T = string>(
    message: string | React.ReactNode,
    type: MessageType,
    buttons?: string[],
    closable?: boolean,
    from?: string,
  ): Promise<T | undefined>;
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
  isVisible(): boolean;
  getMessage(): string | React.ReactNode;
  getIcon(): Icon | undefined;
  getButtons(): string[];
  getType(): MessageType | undefined;
  reset(): void;
}

export abstract class AbstractMessageService implements IMessageService {
  info(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined> {
    return this.open(message, MessageType.Info, buttons, closable);
  }

  warning(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined> {
    return this.open(message, MessageType.Warning, buttons, closable);
  }

  error(message: string | React.ReactNode, buttons?: string[], closable?: boolean): Promise<string | undefined> {
    return this.open(message, MessageType.Error, buttons, closable);
  }
  abstract open<T = string>(
    message: string | React.ReactNode,
    type: MessageType,
    buttons?: any[],
    closable?: boolean,
  ): Promise<T | undefined>;
  abstract hide<T = string>(value?: T): void;
}

export interface IWindowDialogService {
  showOpenDialog(options?: IOpenDialogOptions): Promise<URI[] | undefined>;
  showSaveDialog(options?: ISaveDialogOptions): Promise<URI | undefined>;
}

export const IWindowDialogService = Symbol('IWindowDialogService');

export interface IDialogOptions {
  title?: string;
  defaultUri?: URI;
  filters?: {
    [name: string]: string;
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
