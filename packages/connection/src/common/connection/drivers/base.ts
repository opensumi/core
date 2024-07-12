import { IDisposable } from '@opensumi/ide-core-common';

import { IConnectionShape } from '../types';

export abstract class BaseConnection<T> implements IConnectionShape<T> {
  abstract send(data: T): void;
  abstract onMessage(cb: (data: T) => void): IDisposable;
  abstract onceClose(cb: (code?: number, reason?: string) => void): IDisposable;

  abstract dispose(): void;
}

export interface IRuntimeSocketConnection<T = Uint8Array> extends IConnectionShape<T> {
  isOpen(): boolean;
  onOpen(cb: () => void): IDisposable;

  onClose(cb: (code?: number, reason?: string) => void): IDisposable;
  onError(cb: (error: Error) => void): IDisposable;

  dispose(): void;
}
