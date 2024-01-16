import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class EmptyConnection extends BaseConnection<Uint8Array> {
  send(data: Uint8Array): void {
    // do nothing
  }
  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    return {
      dispose: () => {},
    };
  }
  onceClose(cb: () => void): IDisposable {
    return {
      dispose: () => {},
    };
  }
}
