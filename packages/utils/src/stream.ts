import type { Readable } from 'stream';

export interface IReadableStream<T> {
  on(event: 'data', listener: (chunk: T) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

export function isNodeReadable(stream: any): stream is Readable {
  return stream && typeof stream.read === 'function';
}

export interface IListenReadableOptions {
  onData(data: Uint8Array): void;
  onEnd(): void;
  onError?(error: Error): void;
}

export function listenReadable(stream: IReadableStream<Uint8Array>, options: IListenReadableOptions): void {
  stream.on('data', (chunk: Uint8Array) => {
    options.onData(chunk);
  });
  stream.on('error', (error: Error) => {
    options.onError?.(error);
  });
  stream.on('end', () => {
    options.onEnd();
  });
}
