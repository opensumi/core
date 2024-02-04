import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

export class MessagePortConnection extends BaseConnection<Uint8Array> {
  constructor(public port: MessagePort) {
    super();
  }

  send(data: Uint8Array): void {
    this.port.postMessage(data);
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    const listener = (e: MessageEvent) => {
      cb(e.data);
    };

    this.port.onmessage = listener;
    // this.port.addEventListener('message', listener);
    return {
      dispose: () => {
        this.port.onmessage = null;
        // this.port.removeEventListener('message', listener);
      },
    };
  }

  onceClose(cb: () => void): IDisposable {
    this.port.addEventListener('close', cb);
    return {
      dispose: () => {
        this.port.addEventListener('close', cb);
      },
    };
  }
  dispose(): void {
    // do nothing
  }
}
