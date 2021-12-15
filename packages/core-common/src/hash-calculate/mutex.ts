/* ---------------------------------------------------------------------------------------------
 * MIT License Copyright (c) 2020 Dani All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * https://github.com/Daninet/hash-wasm
 *--------------------------------------------------------------------------------------------*/

// copy and modified from https://github.com/Daninet/hash-wasm/blob/bd3a205ca5603fc80adf71d0966fc72e8d4fa0ef/lib/mutex.ts

export class Mutex {
  private mutex = Promise.resolve();

  lock(): PromiseLike<() => void> {
    let begin: (unlock: () => void) => void = () => {};

    this.mutex = this.mutex.then(() => new Promise(begin));

    return new Promise((res) => {
      begin = res;
    });
  }

  async dispatch<T>(fn: () => PromiseLike<T>): Promise<T> {
    const unlock = await this.lock();
    try {
      return await Promise.resolve(fn());
    } finally {
      unlock();
    }
  }
}
