import type { MessagePort } from 'worker_threads';

import { IDisposable } from '@opensumi/ide-core-common';

import { IBinaryConnectionSocket } from '../sumi-rpc';

export class NodeMessagePortDriver implements IBinaryConnectionSocket {
  constructor(private port: MessagePort) {}
  send(data: Uint8Array): void {
    this.port.postMessage(data);
  }

  onmessage(cb: (data: Uint8Array) => void): IDisposable {
    this.port.on('message', cb);
    return {
      dispose: () => {
        this.port.off('message', cb);
      },
    };
  }
}
