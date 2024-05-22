import { IConnectionShape } from '@opensumi/ide-connection/lib/common/connection/types';
import { IDisposable } from '@opensumi/ide-core-common';

export interface RuntimeSocketConnection<T = Uint8Array> extends IConnectionShape<T> {
  isOpen(): boolean;
  onOpen(cb: () => void): IDisposable;

  send(data: T): void;
  onMessage(cb: (data: T) => void): IDisposable;

  onClose(cb: (code?: number, reason?: string) => void): IDisposable;
  onError(cb: (error: Error) => void): IDisposable;

  dispose(): void;
}

export abstract class BaseConnectionHelper {
  abstract getDefaultClientId(): string;

  abstract createConnection(): RuntimeSocketConnection;
}

export const CONNECTION_HELPER_TOKEN = Symbol('CONNECTION_HELPER_TOKEN');
