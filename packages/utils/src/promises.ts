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

export type PromiseTask<T> = () => Promise<T> | T;

export async function pSeries<T>(tasks: Iterable<PromiseTask<T>>): Promise<T[]> {
  const results = [] as T[];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}

export class PromiseTasks<T> {
  private readonly tasks: PromiseTask<T>[] = [];

  add(task: PromiseTask<T>) {
    this.tasks.push(task);
  }

  addPromise(task: Promise<T>) {
    this.tasks.push(() => task);
  }

  protected promisify() {
    return this.tasks.map((task) => task()) as Promise<T>[];
  }

  async allSettled() {
    return Promise.allSettled(this.promisify());
  }

  async all() {
    return Promise.all(this.promisify());
  }

  async race() {
    return Promise.race(this.promisify());
  }
}
