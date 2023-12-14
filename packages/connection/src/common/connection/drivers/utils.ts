import { Emitter } from '@opensumi/ide-core-common';

import { IConnectionShape } from '../types';

export class EventQueue<T> {
  emitter = new Emitter<T>();

  queue: T[] = [];

  isOpened = false;
  open() {
    this.isOpened = true;
    this.queue.forEach((data) => {
      this.emitter.fire(data);
    });
    this.queue = [];
  }

  push(data: T) {
    if (this.isOpened) {
      this.emitter.fire(data);
    } else {
      this.queue.push(data);
    }
  }

  on(cb: (data: T) => void) {
    const disposable = this.emitter.event(cb);

    if (!this.isOpened) {
      this.open();
    }

    return disposable;
  }
}

export const createQueue = <T>(socket: IConnectionShape<T>): IConnectionShape<T> => {
  const queue = new EventQueue<T>();

  socket.onMessage((data) => {
    queue.push(data);
  });

  return {
    send: (data) => {
      socket.send(data);
    },
    onMessage: (cb) => queue.on(cb),
    onClose: (cb) => socket.onClose(cb),
  };
};
