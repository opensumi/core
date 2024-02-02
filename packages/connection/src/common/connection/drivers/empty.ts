import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class SimpleConnection extends BaseConnection<Uint8Array> {
  constructor(
    public options: {
      send?: (data: Uint8Array) => void;
      onMessage?: (cb: (data: Uint8Array) => void) => IDisposable;
    } = {},
  ) {
    super();
  }
  send(data: Uint8Array): void {
    this.options.send?.(data);
  }
  onMessage(cb: (data: Uint8Array) => void): IDisposable {
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
