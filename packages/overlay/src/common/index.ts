import { MessageType } from '@ali/ide-core-common';

export const IMessageService = Symbol('IMessageService');

export interface IMessageService {
  info<T extends string>(message: string, buttons?: T[]): Promise<T | undefined>;
  warning<T extends string>(message: string, buttons?: T[]): Promise<T | undefined>;
  error<T extends string>(message: string, buttons?: T[]): Promise<T | undefined>;
  open<T extends string>(message: string, type: MessageType, buttons?: T[]): Promise<T | undefined>;
  hide(value?: string): void;
}

export const IDialogService = Symbol('IDialogService');
export interface IDialogService extends IMessageService {
  isVisible(): boolean;
  getMessage(): string;
  getIcon(): string | undefined;
  getButtons(): string[];
  reset(): void;
}

export abstract class AbstractMessageService implements IMessageService {
  info<T extends string>(message: string, buttons?: T[]): Promise<T | undefined> {
    return this.open(message, MessageType.Info, buttons);
  }

  warning<T extends string>(message: string, buttons?: T[]): Promise<T | undefined> {
    return this.open(message, MessageType.Warning, buttons);
  }

  error<T extends string>(message: string, buttons?: T[]): Promise<T | undefined> {
    return this.open<T>(message, MessageType.Error, buttons);
  }
  abstract open<T extends string>(message: string, type: MessageType, buttons?: any[]): Promise<T | undefined>;
  abstract hide(value?: string): void;
}
