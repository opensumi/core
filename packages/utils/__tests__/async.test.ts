// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/async.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as async from '../src/async';
import { isPromiseCanceledError } from '../src/errors';

function deepStrictEqual(a, b) {
  expect(a).toEqual(b);
}

describe('Async', () => {
  test("cancelablePromise - set token, don't wait for inner promise", () => {
    let canceled = 0;
    const promise = async.createCancelablePromise((token) => {
      token.onCancellationRequested((_) => {
        canceled += 1;
      });
      return new Promise(() => {
        /* never*/
      });
    });
    const result = promise.then(
      (_) => expect(false).toBeTruthy(),
      (err) => {
        expect(canceled).toBe(1);
        expect(isPromiseCanceledError(err)).toBeTruthy();
      },
    );
    promise.cancel();
    promise.cancel(); // cancel only once
    return result;
  });

  test('cancelablePromise - cancel despite inner promise being resolved', () => {
    let canceled = 0;
    const promise = async.createCancelablePromise((token) => {
      token.onCancellationRequested((_) => {
        canceled += 1;
      });
      return Promise.resolve(1234);
    });
    const result = promise.then(
      (_) => expect(false).toBeTruthy(),
      (err) => {
        expect(canceled).toBe(1);
        expect(isPromiseCanceledError(err)).toBeTruthy();
      },
    );
    promise.cancel();
    return result;
  });

  // Cancelling a sync cancelable promise will fire the cancelled token.
  // Also, every `then` callback runs in another execution frame.
  test('CancelablePromise execution order (sync)', () => {
    const order: string[] = [];

    const cancellablePromise = async.createCancelablePromise((token) => {
      order.push('in callback');
      token.onCancellationRequested((_) => order.push('cancelled'));
      return Promise.resolve(1234);
    });

    order.push('afterCreate');

    const promise = cancellablePromise.then(undefined, () => null).then(() => order.push('finally'));

    cancellablePromise.cancel();
    order.push('afterCancel');

    return promise.then(() =>
      deepStrictEqual(order, ['in callback', 'afterCreate', 'cancelled', 'afterCancel', 'finally']),
    );
  });

  // Cancelling an async cancelable promise is just the same as a sync cancellable promise.
  test('CancelablePromise execution order (async)', () => {
    const order: string[] = [];

    const cancellablePromise = async.createCancelablePromise((token) => {
      order.push('in callback');
      token.onCancellationRequested((_) => order.push('cancelled'));
      return new Promise((c) => setTimeout(c.bind(1234), 0));
    });

    order.push('afterCreate');

    const promise = cancellablePromise.then(undefined, () => null).then(() => order.push('finally'));

    cancellablePromise.cancel();
    order.push('afterCancel');

    return promise.then(() =>
      deepStrictEqual(order, ['in callback', 'afterCreate', 'cancelled', 'afterCancel', 'finally']),
    );
  });

  test('cancelablePromise - get inner result', async () => {
    const promise = async.createCancelablePromise(() => async.timeout(12).then((_) => 1234));

    const result = await promise;
    expect(result).toBe(1234);
  });

  test('Throttler - non async', () => {
    let count = 0;
    const factory = () => Promise.resolve(++count);

    const throttler = new async.Throttler();

    return Promise.all([
      throttler.queue(factory).then((result) => {
        expect(result).toBe(1);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
    ]).then(() => expect(count).toBe(2));
  });

  test('Throttler', () => {
    let count = 0;
    const factory = () => async.timeout(0).then(() => ++count);

    const throttler = new async.Throttler();

    return Promise.all([
      throttler.queue(factory).then((result) => {
        expect(result).toBe(1);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
      throttler.queue(factory).then((result) => {
        expect(result).toBe(2);
      }),
    ]).then(() =>
      Promise.all([
        throttler.queue(factory).then((result) => {
          expect(result).toBe(3);
        }),
        throttler.queue(factory).then((result) => {
          expect(result).toBe(4);
        }),
        throttler.queue(factory).then((result) => {
          expect(result).toBe(4);
        }),
        throttler.queue(factory).then((result) => {
          expect(result).toBe(4);
        }),
        throttler.queue(factory).then((result) => {
          expect(result).toBe(4);
        }),
      ]),
    );
  });

  test('Throttler - last factory should be the one getting called', () => {
    const factoryFactory = (n: number) => () => async.timeout(0).then(() => n);

    const throttler = new async.Throttler();

    const promises: Promise<any>[] = [];

    promises.push(
      throttler.queue(factoryFactory(1)).then((n) => {
        expect(n).toBe(1);
      }),
    );
    promises.push(
      throttler.queue(factoryFactory(2)).then((n) => {
        expect(n).toBe(3);
      }),
    );
    promises.push(
      throttler.queue(factoryFactory(3)).then((n) => {
        expect(n).toBe(3);
      }),
    );

    return Promise.all(promises);
  });

  test('Delayer', () => {
    let count = 0;
    const factory = () => Promise.resolve(++count);

    const delayer = new async.Delayer(0);
    const promises: Promise<any>[] = [];

    expect(!delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then((result) => {
        expect(result).toBe(1);
        expect(!delayer.isTriggered()).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then((result) => {
        expect(result).toBe(1);
        expect(!delayer.isTriggered()).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then((result) => {
        expect(result).toBe(1);
        expect(!delayer.isTriggered()).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    return Promise.all(promises).then(() => {
      expect(!delayer.isTriggered()).toBeTruthy();
    });
  });

  test('Delayer - simple cancel', () => {
    let count = 0;
    const factory = () => Promise.resolve(++count);

    const delayer = new async.Delayer(0);

    expect(!delayer.isTriggered()).toBeTruthy();

    const p = delayer.trigger(factory).then(
      () => {
        expect(delayer.isTriggered()).toBeTruthy();
      },
      () => {
        expect(!delayer.isTriggered()).toBeTruthy();
      },
    );

    expect(delayer.isTriggered()).toBeTruthy();
    delayer.cancel();
    expect(!delayer.isTriggered()).toBeTruthy();

    return p;
  });

  test('Delayer - cancel should cancel all calls to trigger', () => {
    let count = 0;
    const factory = () => Promise.resolve(++count);

    const delayer = new async.Delayer(0);
    const promises: Promise<any>[] = [];

    expect(!delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then(undefined, () => {
        expect(true).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then(undefined, () => {
        expect(true).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factory).then(undefined, () => {
        expect(true).toBeTruthy();
      }),
    );
    expect(delayer.isTriggered()).toBeTruthy();

    delayer.cancel();

    return Promise.all(promises).then(() => {
      expect(!delayer.isTriggered()).toBeTruthy();
    });
  });

  test('Delayer - trigger, cancel, then trigger again', () => {
    let count = 0;
    const factory = () => Promise.resolve(++count);

    const delayer = new async.Delayer(0);
    let promises: Promise<any>[] = [];

    expect(!delayer.isTriggered()).toBeTruthy();

    const p = delayer.trigger(factory).then((result) => {
      expect(result).toBe(1);
      expect(!delayer.isTriggered()).toBeTruthy();

      promises.push(
        delayer.trigger(factory).then(undefined, () => {
          expect(true).toBeTruthy();
        }),
      );
      expect(delayer.isTriggered()).toBeTruthy();

      promises.push(
        delayer.trigger(factory).then(undefined, () => {
          expect(true).toBeTruthy();
        }),
      );
      expect(delayer.isTriggered()).toBeTruthy();

      delayer.cancel();

      const p = Promise.all(promises).then(() => {
        promises = [];

        expect(!delayer.isTriggered()).toBeTruthy();

        promises.push(
          delayer.trigger(factory).then(() => {
            expect(result).toBe(1);
            expect(!delayer.isTriggered()).toBeTruthy();
          }),
        );
        expect(delayer.isTriggered()).toBeTruthy();

        promises.push(
          delayer.trigger(factory).then(() => {
            expect(result).toBe(1);
            expect(!delayer.isTriggered()).toBeTruthy();
          }),
        );
        expect(delayer.isTriggered()).toBeTruthy();

        const p = Promise.all(promises).then(() => {
          expect(!delayer.isTriggered()).toBeTruthy();
        });

        expect(delayer.isTriggered()).toBeTruthy();

        return p;
      });

      return p;
    });

    expect(delayer.isTriggered()).toBeTruthy();

    return p;
  });

  test('Delayer - last task should be the one getting called', () => {
    const factoryFactory = (n: number) => () => Promise.resolve(n);

    const delayer = new async.Delayer(0);
    const promises: Promise<any>[] = [];

    expect(!delayer.isTriggered()).toBeTruthy();

    promises.push(
      delayer.trigger(factoryFactory(1)).then((n) => {
        expect(n).toBe(3);
      }),
    );
    promises.push(
      delayer.trigger(factoryFactory(2)).then((n) => {
        expect(n).toBe(3);
      }),
    );
    promises.push(
      delayer.trigger(factoryFactory(3)).then((n) => {
        expect(n).toBe(3);
      }),
    );

    const p = Promise.all(promises).then(() => {
      expect(!delayer.isTriggered()).toBeTruthy();
    });

    expect(delayer.isTriggered()).toBeTruthy();

    return p;
  });
});
