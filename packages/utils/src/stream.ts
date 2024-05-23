import { IDisposable } from './disposable';
import { AbortError } from './errors';
import { EventQueue } from './event';

import type { Readable } from 'stream';

export interface IReadableStream<T, E extends Error = Error> {
  on(event: 'data', listener: (chunk: T) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: E) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

export function isReadableStream(stream: any): stream is Readable {
  return stream && (typeof stream.read === 'function' || stream instanceof SumiReadableStream);
}

export interface IListenReadableOptions<T, E> {
  onData(data: T): void;
  onEnd(): void;
  onError?(error: E): void;
}

export function listenReadable<T = Uint8Array, E extends Error = Error>(
  stream: IReadableStream<T, E>,
  options: IListenReadableOptions<T, E>,
): void {
  stream.on('data', (chunk: T) => {
    options.onData(chunk);
  });
  stream.on('error', (error: E) => {
    options.onError?.(error);
  });
  stream.on('end', () => {
    options.onEnd();
  });
}

export function listenGroupReadable<T = Uint8Array, E extends Error = Error>(
  streams: IReadableStream<T, E>[],
  options: IListenReadableOptions<T, E>,
): void {
  let endCount = streams.length;

  streams.map((stream) => {
    listenReadable(stream, {
      onData: options.onData.bind(options),
      onError: options.onError?.bind(options),
      onEnd: () => {
        endCount--;

        if (endCount === 0) {
          options.onEnd();
        }
      },
    });
  });
}

export class SumiReadableStream<T, E extends Error = Error> implements IReadableStream<T, E> {
  protected dataQueue = new EventQueue<T>();
  protected endQueue = new EventQueue<void>();
  protected errorQueue = new EventQueue<E>();

  on(event: 'error', listener: (err: E) => void): this;
  on(event: 'data', listener: (chunk: T) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: unknown, listener: unknown): this {
    switch (event) {
      case 'error':
        this.onError(listener as (err: E) => void);
        break;
      case 'data':
        this.onData(listener as (chunk: T) => void);
        break;
      case 'end':
        this.onEnd(listener as () => void);
        break;
      default:
        break;
    }
    return this;
  }

  onData(cb: (data: T) => void): IDisposable {
    return this.dataQueue.on(cb);
  }

  onEnd(cb: () => void): IDisposable {
    return this.endQueue.on(cb);
  }

  onError(cb: (err: E) => void): IDisposable {
    return this.errorQueue.on(cb);
  }

  emitData(buffer: T) {
    this.dataQueue.push(buffer);
  }

  emitError(err: E) {
    this.errorQueue.push(err);
  }

  end() {
    this.dataQueue.dispose();
    this.endQueue.push(undefined);
    this.endQueue.dispose();
  }

  abort() {
    this.dataQueue.dispose();
    this.errorQueue.push(new AbortError() as E);
    this.errorQueue.dispose();
  }
}
