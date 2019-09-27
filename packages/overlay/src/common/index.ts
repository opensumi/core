import * as React from 'react';
import { MessageType } from '@ali/ide-core-common';
import { CtxMenuRenderParams } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';

export const IMessageService = Symbol('IMessageService');

export interface IMessageService {
  info(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  warning(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  error(message: string | React.ReactNode, buttons?: string[]): Promise<string | undefined>;
  open(message: string | React.ReactNode, type: MessageType, buttons?: string[]): Promise<string | undefined>;
  hide(value?: string): void;
}

export const IDialogService = Symbol('IDialogService');
export interface IDialogService extends IMessageService {
  isVisible(): boolean;
  getMessage(): string | React.ReactNode;
  getIcon(): string | undefined;
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
