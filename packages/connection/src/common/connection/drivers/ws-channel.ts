import { IDisposable } from '@opensumi/ide-core-common';

import type { WSChannel } from '../../ws-channel';

import { BaseConnection } from './base';

export class WSChannelConnection extends BaseConnection<string> {
  constructor(private socket: WSChannel) {
    super();
  }
  send(data: string): void {
    this.socket.send(data);
  }

  onMessage(cb: (data: string) => void): IDisposable {
    const handler = (data: string) => {
      cb(data);
    };
    const remove = this.socket.onMessage(handler);
    return {
      dispose: () => {
        remove();
      },
    };
  }
  onClose(cb: () => void): IDisposable {
    const handler = () => {
      cb();
    };
    const remove = this.socket.onClose(handler);
    return {
      dispose: () => {
        remove();
      },
    };
  }
}
