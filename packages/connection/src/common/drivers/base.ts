import { IDisposable } from '@opensumi/ide-core-common';

import { IBinaryConnectionSocket } from '../sumi-rpc';

import { createQueue } from './utils';

export abstract class BaseDriver implements IBinaryConnectionSocket {
  abstract send(data: Uint8Array): void;
  abstract onmessage(cb: (data: Uint8Array) => void): IDisposable;

  createQueue(): IBinaryConnectionSocket {
    return createQueue(this);
  }
}
