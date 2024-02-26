import type { Readable } from 'stream';

export interface IReadableStream<T> {
  onData(callback: (data: T) => void): void;
  onEnd(callback: () => void): void;
}

export function isNodeReadable<T>(stream: any): stream is Readable {
  return typeof stream.read === 'function';
}

export interface IListenReadableOptions {
  onData(data: Uint8Array): void;
  onEnd(): void;
  onError?(error: Error): void;
}

export function listenReadable(stream: Readable, options: IListenReadableOptions): void {
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
