import { IDisposable } from '@opensumi/ide-core-common';

import { IConnectionShape } from '../types';

import { createQueue } from './utils';

export abstract class BaseConnection<T> implements IConnectionShape<T> {
  abstract send(data: T): void;
  abstract onMessage(cb: (data: T) => void): IDisposable;
  abstract onceClose(cb: () => void): IDisposable;

  createQueue(): IConnectionShape<T> {
    return createQueue(this);
  }
}
