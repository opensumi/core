import { CancellationToken } from './cancellation';

export type MaybePromise<T> = T | Promise<T> | PromiseLike<T>;

export function hookCancellationToken<T>(token: CancellationToken, promise: Promise<T>): PromiseLike<T> {
  return new Promise<T>((resolve, reject) => {
      const sub = token.onCancellationRequested(() => reject(new Error('This promise is cancelled')));
      promise.then(value => {
          sub.dispose();
          resolve(value);
      }).catch(err => {
          sub.dispose();
          reject(err);
      });
  });
}
