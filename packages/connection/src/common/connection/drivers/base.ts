import { IDisposable } from '@opensumi/ide-core-common';
import { MessageConnection } from '@opensumi/vscode-jsonrpc';

import { createWebSocketConnection } from '../../message';
import { IConnectionShape } from '../types';

import { createQueue } from './utils';

export abstract class BaseConnection<T> implements IConnectionShape<T> {
  abstract send(data: T): void;
  abstract onMessage(cb: (data: T) => void): IDisposable;
  abstract onClose(cb: () => void): IDisposable;

  createQueue(): IConnectionShape<T> {
    return createQueue(this);
  }

  createMessageConnection(): MessageConnection {
    return createWebSocketConnection(this);
  }
}
