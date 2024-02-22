import { IDisposable } from '@opensumi/ide-core-common';

import { BaseConnection } from './base';

import type { MessagePort } from 'worker_threads';

export class NodeMessagePortConnection extends BaseConnection<Uint8Array> {
  constructor(private port: MessagePort) {
    super();
  }

  send(data: Uint8Array): void {
    this.port.postMessage(data);
  }

  onMessage(cb: (data: Uint8Array) => void): IDisposable {
    this.port.on('message', cb);
    return {
      dispose: () => {
        this.port.off('message', cb);
      },
    };
  }

  onceClose(cb: () => void): IDisposable {
    this.port.once('close', cb);
    return {
      dispose: () => {
        this.port.off('close', cb);
      },
    };
  }
  dispose(): void {
    this.port.removeAllListeners();
  }
}
