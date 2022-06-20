/**
 * Simple implementation of the deferred pattern.
 * An object that exposes a promise and functions to resolve and reject it.
 */
export class Deferred<T> {
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (err?: any) => void;

  promise = new Promise<T>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}

export async function pSeries<T>(tasks: Iterable<() => Promise<T> | T>): Promise<T[]> {
  const results = [] as T[];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}

export async function pLimit<T>(tasks: (() => Promise<T> | T)[], limit: number) {
  let count = 0;
  const queue = [] as (() => void)[];
  async function run(fn: () => Promise<T> | T) {
    if (count > limit) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    }
    count++;
    const res = await fn();
    count--;
    if (queue.length > 0) {
      queue.shift()!();
    }
    return res;
  }
  const data = await Promise.all(tasks.map((fn) => run(fn)));
  return data;
}
