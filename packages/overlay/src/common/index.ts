import * as React from 'react';
import { MessageType, URI } from '@ali/ide-core-common';

export const IMessageService = Symbol('IMessageService');

export * from '../browser/snackbar';

export interface IMessageService {
  info(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  warning(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  error(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  open(message: string | React.ReactNode, type: MessageType, buttons?: string[]): Promise<string | undefined>;
  hide(value?: string): void;
}

export interface Icon {
  color: string;
  className: string;
}

export const IDialogService = Symbol('IDialogService');
export interface IDialogService extends IMessageService {
  isVisible(): boolean;
  getMessage(): string | React.ReactNode;
  getIcon(): Icon | undefined;
  getButtons(): string[];
  reset(): void;
}

export abstract class AbstractMessageService implements IMessageService {
  info(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined> {
    return this.open(message, MessageType.Info, buttons);
  }

  warning(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined> {
    return this.open(message, MessageType.Warning, buttons);
  }

  error(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined> {
    return this.open(message, MessageType.Error, buttons);
  }
  abstract open(message: string | React.ReactNode, type: MessageType, buttons?: any[]): Promise<string | undefined>;
  abstract hide(value?: string): void;
}

export interface IWindowDialogService {
  showOpenDialog(options?: IOpenDialogOptions): Promise<URI[] | undefined>;
}

export const IWindowDialogService = Symbol('IWindowDialogService');

export interface IOpenDialogOptions {
  canSelectFiles?: boolean;
  canSelectFolders?: boolean;
  canSelectMany?: boolean;
  defaultUri?: URI;
  filters?: {
    [name: string]: string,
  };
  openLabel?: string;
}
