import { Emitter } from '@opensumi/ide-core-common';
import { PlatformBuffer } from '@opensumi/ide-core-common/lib/connection/types';

import { IBinaryConnectionSocket } from '../sumi-rpc';

export class EventQueue {
  emitter = new Emitter<PlatformBuffer>();

  queue: PlatformBuffer[] = [];

  isOpened = false;
  open() {
    this.isOpened = true;
    this.queue.forEach((data) => {
      this.emitter.fire(data);
    });
    this.queue = [];
  }

  push(data: PlatformBuffer) {
    if (this.isOpened) {
      this.emitter.fire(data);
    } else {
      this.queue.push(data);
    }
  }

  on(cb: (data: PlatformBuffer) => void) {
    const disposable = this.emitter.event(cb);

    if (!this.isOpened) {
      this.open();
    }

    return disposable;
  }
}

export const createQueue = (socket: IBinaryConnectionSocket): IBinaryConnectionSocket => {
  const queue = new EventQueue();

  socket.onmessage((data) => {
    queue.push(data);
  });

  return {
    send: (data) => {
      socket.send(data);
    },
    onmessage: (cb) => queue.on(cb),
  };
};
