import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class SimpleConnection<T = Uint8Array> extends BaseConnection<T> {
  constructor(
    public options: {
      send?: (data: T) => void;
      onMessage?: (cb: (data: T) => void) => IDisposable;
    } = {},
  ) {
    super();
  }
  send(data: T): void {
    this.options.send?.(data);
  }
  onMessage(cb: (data: T) => void): IDisposable {
    if (this.options.onMessage) {
      return this.options.onMessage(cb);
    }
    return {
      dispose: () => {},
    };
  }
  onceClose(cb: () => void): IDisposable {
    return {
      dispose: () => {},
    };
  }
  dispose(): void {
    // do nothing
  }
}
