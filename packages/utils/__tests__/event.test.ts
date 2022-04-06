// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/event.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from '../src/async';
import { CancellationToken } from '../src/cancellation';
import { IDisposable, Disposable } from '../src/disposable';
import { errorHandler, setUnexpectedErrorHandler } from '../src/errors';
import {
  Event,
  Emitter,
  EventBufferer,
  EventMultiplexer,
  PauseableEmitter,
  AsyncEmitter,
  WaitUntilEvent,
} from '../src/event';

function deepStrictEqual(a, b) {
  expect(a).toEqual(b);
}

function strictEqual(a, b) {
  expect(a).toBe(b);
}

namespace Samples {
  export class EventCounter {
    count = 0;

    reset() {
      this.count = 0;
    }

    onEvent() {
      this.count += 1;
    }
  }

  export class Document3 {
    private readonly _onDidChange = new Emitter<string>();

    onDidChange: Event<string> = this._onDidChange.event;

    setText(value: string) {
      // ...
      this._onDidChange.fire(value);
    }
  }
}

describe('Event', () => {
  const counter = new Samples.EventCounter();

  beforeEach(() => counter.reset());

  test('Emitter plain', () => {
    const doc = new Samples.Document3();

    document.createElement('div').onclick = function () {};
    const subscription = doc.onDidChange(counter.onEvent, counter);

    doc.setText('far');
    doc.setText('boo');

    // unhook listener
    subscription.dispose();
    doc.setText('boo');
    expect(counter.count).toBe(2);
  });

  test('Emitter, bucket', () => {
    const bucket: IDisposable[] = [];
    const doc = new Samples.Document3();
    const subscription = doc.onDidChange(counter.onEvent, counter, bucket);

    doc.setText('far');
    doc.setText('boo');

    // unhook listener
    while (bucket.length) {
      bucket.pop()!.dispose();
    }
    doc.setText('boo');

    // noop
    subscription.dispose();

    doc.setText('boo');
    expect(counter.count).toBe(2);
  });

  test('Emitter, store', () => {
    const bucket = [Disposable.create(() => {})];
    const doc = new Samples.Document3();
    const subscription = doc.onDidChange(counter.onEvent, counter, bucket);

    doc.setText('far');
    doc.setText('boo');

    // unhook listener
    for (const dis of bucket) {
      dis.dispose();
    }
    doc.setText('boo');

    // noop
    subscription.dispose();

    doc.setText('boo');
    expect(counter.count).toBe(2);
  });

  test('onFirstAdd|onLastRemove', () => {
    let firstCount = 0;
    let lastCount = 0;
    const a = new Emitter({
      onFirstListenerAdd() {
        firstCount += 1;
      },
      onLastListenerRemove() {
        lastCount += 1;
      },
    });

    expect(firstCount).toBe(0);
    expect(lastCount).toBe(0);

    let subscription = a.event(function () {});
    expect(firstCount).toBe(1);
    expect(lastCount).toBe(0);

    subscription.dispose();
    expect(firstCount).toBe(1);
    expect(lastCount).toBe(1);

    subscription = a.event(function () {});
    expect(firstCount).toBe(2);
    expect(lastCount).toBe(1);
  });

  test('throwingListener', () => {
    const origErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => null);

    try {
      const a = new Emitter<undefined>();
      let hit = false;
      a.event(function () {
        // eslint-disable-next-line no-throw-literal
        throw 9;
      });
      a.event(function () {
        hit = true;
      });
      a.fire(undefined);
      expect(hit).toBe(true);
    } finally {
      setUnexpectedErrorHandler(origErrorHandler);
    }
  });

  test('reusing event function and context', () => {
    let counter = 0;
    function listener() {
      counter += 1;
    }
    const context = {};

    const emitter = new Emitter<undefined>();
    const reg1 = emitter.event(listener, context);
    const reg2 = emitter.event(listener, context);

    emitter.fire(undefined);
    expect(counter).toBe(2);

    reg1.dispose();
    emitter.fire(undefined);
    expect(counter).toBe(3);

    reg2.dispose();
    emitter.fire(undefined);
    expect(counter).toBe(3);
  });

  test('Debounce Event', (done: () => void) => {
    const doc = new Samples.Document3();

    const onDocDidChange = Event.debounce(
      doc.onDidChange,
      (prev: string[] | undefined, cur) => {
        if (!prev) {
          prev = [cur];
        } else if (prev.indexOf(cur) < 0) {
          prev.push(cur);
        }
        return prev;
      },
      10,
    );

    let count = 0;

    onDocDidChange((keys) => {
      count++;
      expect(keys).toBeTruthy();
      if (count === 1) {
        doc.setText('4');
        deepStrictEqual(keys, ['1', '2', '3']);
      } else if (count === 2) {
        deepStrictEqual(keys, ['4']);
        done();
      }
    });

    doc.setText('1');
    doc.setText('2');
    doc.setText('3');
  });

  test('Debounce Event - leading', async () => {
    const emitter = new Emitter<void>();
    const debounced = Event.debounce(emitter.event, (l, e) => e, 0, /* leading=*/ true);

    let calls = 0;
    debounced(() => {
      calls++;
    });

    // If the source event is fired once, the debounced (on the leading edge) event should be fired only once
    emitter.fire();

    await timeout(1);
    expect(calls).toBe(1);
  });

  test('Debounce Event - leading', async () => {
    const emitter = new Emitter<void>();
    const debounced = Event.debounce(emitter.event, (l, e) => e, 0, /* leading=*/ true);

    let calls = 0;
    debounced(() => {
      calls++;
    });

    // If the source event is fired multiple times, the debounced (on the leading edge) event should be fired twice
    emitter.fire();
    emitter.fire();
    emitter.fire();
    await timeout(1);
    expect(calls).toBe(2);
  });

  test('Debounce Event - leading reset', async () => {
    const emitter = new Emitter<number>();
    const debounced = Event.debounce(emitter.event, (l, e) => (l ? l + 1 : 1), 0, /* leading=*/ true);

    const calls: number[] = [];
    debounced((e) => calls.push(e));

    emitter.fire(1);
    emitter.fire(1);

    await timeout(1);
    // deepStrictEqual(calls, [1, 1]);
    deepStrictEqual(calls, [1, 2]);
  });

  test('Emitter - In Order Delivery', () => {
    const a = new Emitter<string>();
    const listener2Events: string[] = [];
    a.event(function listener1(event) {
      if (event === 'e1') {
        a.fire('e2');
        // assert that all events are delivered at this point
        deepStrictEqual(listener2Events, ['e1', 'e2']);
      }
    });
    a.event(function listener2(event) {
      listener2Events.push(event);
    });
    a.fire('e1');

    // assert that all events are delivered in order
    deepStrictEqual(listener2Events, ['e1', 'e2']);
  });
});

describe('AsyncEmitter', () => {
  test('event has waitUntil-function', async () => {
    interface E extends WaitUntilEvent {
      foo: boolean;
      bar: number;
    }

    const emitter = new AsyncEmitter<E>();

    emitter.event((e) => {
      expect(e.foo).toBe(true);
      expect(e.bar).toBe(1);
      expect(typeof e.waitUntil).toBe('function');
    });

    emitter.fireAsync({ foo: true, bar: 1 }, CancellationToken.None);
    emitter.dispose();
  });

  test('sequential delivery', async () => {
    interface E extends WaitUntilEvent {
      foo: boolean;
    }

    let globalState = 0;
    const emitter = new AsyncEmitter<E>();

    emitter.event((e) => {
      e.waitUntil!(
        timeout(10).then((_) => {
          expect(globalState).toBe(0);
          globalState += 1;
        }),
      );
    });

    emitter.event((e) => {
      e.waitUntil!(
        timeout(1).then((_) => {
          expect(globalState).toBe(1);
          globalState += 1;
        }),
      );
    });

    await emitter.fireAsync({ foo: true }, CancellationToken.None);
    expect(globalState).toBe(2);
  });

  test('sequential, in-order delivery', async () => {
    interface E extends WaitUntilEvent {
      foo: number;
    }
    const events: number[] = [];
    let done = false;
    const emitter = new AsyncEmitter<E>();

    // e1
    emitter.event((e) => {
      e.waitUntil!(
        timeout(10).then(async (_) => {
          if (e.foo === 1) {
            await emitter.fireAsync({ foo: 2 }, CancellationToken.None);
            deepStrictEqual(events, [1, 2]);
            done = true;
          }
        }),
      );
    });

    // e2
    emitter.event((e) => {
      events.push(e.foo);
      e.waitUntil!(timeout(7));
    });

    await emitter.fireAsync({ foo: 1 }, CancellationToken.None);
    expect(done).toBeTruthy();
  });

  test('catch errors', async () => {
    const origErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => null);

    interface E extends WaitUntilEvent {
      foo: boolean;
    }

    let globalState = 0;
    const emitter = new AsyncEmitter<E>();

    emitter.event((e) => {
      globalState += 1;
      e.waitUntil!(new Promise((_r, reject) => reject(new Error())));
    });

    emitter.event((e) => {
      globalState += 1;
      e.waitUntil!(timeout(10));
      e.waitUntil!(timeout(20).then(() => globalState++)); // multiple `waitUntil` are supported and awaited on
    });

    await emitter
      .fireAsync({ foo: true }, CancellationToken.None)
      .then(() => {
        expect(globalState).toBe(3);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.log(e);
        expect(false).toBeTruthy();
      });

    setUnexpectedErrorHandler(origErrorHandler);
  });
});

describe('PausableEmitter', () => {
  test('basic', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>();

    emitter.event((e) => data.push(e));
    emitter.fire(1);
    emitter.fire(2);

    deepStrictEqual(data, [1, 2]);
  });

  test('pause/resume - no merge', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>();

    emitter.event((e) => data.push(e));
    emitter.fire(1);
    emitter.fire(2);
    deepStrictEqual(data, [1, 2]);

    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    deepStrictEqual(data, [1, 2]);

    emitter.resume();
    deepStrictEqual(data, [1, 2, 3, 4]);
    emitter.fire(5);
    deepStrictEqual(data, [1, 2, 3, 4, 5]);
  });

  test('pause/resume - merge', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>({ merge: (a) => a.reduce((p, c) => p + c, 0) });

    emitter.event((e) => data.push(e));
    emitter.fire(1);
    emitter.fire(2);
    deepStrictEqual(data, [1, 2]);

    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    deepStrictEqual(data, [1, 2]);

    emitter.resume();
    deepStrictEqual(data, [1, 2, 7]);

    emitter.fire(5);
    deepStrictEqual(data, [1, 2, 7, 5]);
  });

  test('double pause/resume', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>();

    emitter.event((e) => data.push(e));
    emitter.fire(1);
    emitter.fire(2);
    deepStrictEqual(data, [1, 2]);

    emitter.pause();
    emitter.pause();
    emitter.fire(3);
    emitter.fire(4);
    deepStrictEqual(data, [1, 2]);

    emitter.resume();
    deepStrictEqual(data, [1, 2]);

    emitter.resume();
    deepStrictEqual(data, [1, 2, 3, 4]);

    emitter.resume();
    deepStrictEqual(data, [1, 2, 3, 4]);
  });

  test('resume, no pause', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>();

    emitter.event((e) => data.push(e));
    emitter.fire(1);
    emitter.fire(2);
    deepStrictEqual(data, [1, 2]);

    emitter.resume();
    emitter.fire(3);
    deepStrictEqual(data, [1, 2, 3]);
  });

  test('nested pause', () => {
    const data: number[] = [];
    const emitter = new PauseableEmitter<number>();

    let once = true;
    emitter.event((e) => {
      data.push(e);

      if (once) {
        emitter.pause();
        once = false;
      }
    });
    emitter.event((e) => {
      data.push(e);
    });

    emitter.pause();
    emitter.fire(1);
    emitter.fire(2);
    deepStrictEqual(data, []);

    emitter.resume();
    deepStrictEqual(data, [1, 1]); // paused after first event

    emitter.resume();
    deepStrictEqual(data, [1, 1, 2, 2]); // remaing event delivered

    emitter.fire(3);
    deepStrictEqual(data, [1, 1, 2, 2, 3, 3]);
  });
});

describe('Event utils', () => {
  describe('EventBufferer', () => {
    test('should not buffer when not wrapped', () => {
      const bufferer = new EventBufferer();
      const counter = new Samples.EventCounter();
      const emitter = new Emitter<void>();
      const event = bufferer.wrapEvent(emitter.event);
      const listener = event(counter.onEvent, counter);

      expect(counter.count).toBe(0);
      emitter.fire();
      expect(counter.count).toBe(1);
      emitter.fire();
      expect(counter.count).toBe(2);
      emitter.fire();
      expect(counter.count).toBe(3);

      listener.dispose();
    });

    test('should buffer when wrapped', () => {
      const bufferer = new EventBufferer();
      const counter = new Samples.EventCounter();
      const emitter = new Emitter<void>();
      const event = bufferer.wrapEvent(emitter.event);
      const listener = event(counter.onEvent, counter);

      expect(counter.count).toBe(0);
      emitter.fire();
      expect(counter.count).toBe(1);

      bufferer.bufferEvents(() => {
        emitter.fire();
        expect(counter.count).toBe(1);
        emitter.fire();
        expect(counter.count).toBe(1);
      });

      expect(counter.count).toBe(3);
      emitter.fire();
      expect(counter.count).toBe(4);

      listener.dispose();
    });

    test('once', () => {
      const emitter = new Emitter<void>();

      let counter1 = 0;
      let counter2 = 0;
      let counter3 = 0;

      const listener1 = emitter.event(() => counter1++);
      const listener2 = Event.once(emitter.event)(() => counter2++);
      const listener3 = Event.once(emitter.event)(() => counter3++);

      expect(counter1).toBe(0);
      expect(counter2).toBe(0);
      expect(counter3).toBe(0);

      listener3.dispose();
      emitter.fire();
      expect(counter1).toBe(1);
      expect(counter2).toBe(1);
      expect(counter3).toBe(0);

      emitter.fire();
      expect(counter1).toBe(2);
      expect(counter2).toBe(1);
      expect(counter3).toBe(0);

      listener1.dispose();
      listener2.dispose();
    });
  });

  describe('fromPromise', () => {
    test('should emit when done', async () => {
      let count = 0;

      const event = Event.fromPromise(Promise.resolve(null));
      event(() => count++);

      expect(count).toBe(0);

      await timeout(10);
      expect(count).toBe(1);
    });

    test('should emit when done - setTimeout', async () => {
      let count = 0;

      const promise = timeout(5);
      const event = Event.fromPromise(promise);
      event(() => count++);

      expect(count).toBe(0);
      await promise;
      expect(count).toBe(1);
    });
  });

  describe('stopwatch', () => {
    test('should emit', () => {
      const emitter = new Emitter<void>();
      const event = Event.stopwatch(emitter.event);

      return new Promise((c, e) => {
        event((duration) => {
          try {
            expect(duration > 0).toBeTruthy();
          } catch (err) {
            e(err);
          }

          c(undefined);
        });

        setTimeout(() => emitter.fire(), 10);
      });
    });
  });

  describe('buffer', () => {
    test('should buffer events', () => {
      const result: number[] = [];
      const emitter = new Emitter<number>();
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event);

      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      expect(result).toEqual([]);

      const listener = bufferedEvent((num) => result.push(num));
      deepStrictEqual(result, [1, 2, 3]);

      emitter.fire(4);
      deepStrictEqual(result, [1, 2, 3, 4]);

      listener.dispose();
      emitter.fire(5);
      deepStrictEqual(result, [1, 2, 3, 4]);
    });

    test('should buffer events on next tick', async () => {
      const result: number[] = [];
      const emitter = new Emitter<number>();
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event, true);

      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      expect(result).toEqual([]);

      const listener = bufferedEvent((num) => result.push(num));
      deepStrictEqual(result, []);

      await timeout(10);
      emitter.fire(4);
      deepStrictEqual(result, [1, 2, 3, 4]);
      listener.dispose();
      emitter.fire(5);
      deepStrictEqual(result, [1, 2, 3, 4]);
    });

    test('should fire initial buffer events', () => {
      const result: number[] = [];
      const emitter = new Emitter<number>();
      const event = emitter.event;
      const bufferedEvent = Event.buffer(event, false, [-2, -1, 0]);

      emitter.fire(1);
      emitter.fire(2);
      emitter.fire(3);
      expect(result).toEqual([]);

      bufferedEvent((num) => result.push(num));
      deepStrictEqual(result, [-2, -1, 0, 1, 2, 3]);
    });
  });

  describe('EventMultiplexer', () => {
    test('works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();
      m.event((r) => result.push(r));

      const e1 = new Emitter<number>();
      m.add(e1.event);

      deepStrictEqual(result, []);

      e1.fire(0);
      deepStrictEqual(result, [0]);
    });

    test('multiplexer dispose works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();
      m.event((r) => result.push(r));

      const e1 = new Emitter<number>();
      m.add(e1.event);

      deepStrictEqual(result, []);

      e1.fire(0);
      deepStrictEqual(result, [0]);

      m.dispose();
      deepStrictEqual(result, [0]);

      e1.fire(0);
      deepStrictEqual(result, [0]);
    });

    test('event dispose works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();
      m.event((r) => result.push(r));

      const e1 = new Emitter<number>();
      m.add(e1.event);

      deepStrictEqual(result, []);

      e1.fire(0);
      deepStrictEqual(result, [0]);

      e1.dispose();
      deepStrictEqual(result, [0]);

      e1.fire(0);
      deepStrictEqual(result, [0]);
    });

    test('mutliplexer event dispose works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();
      m.event((r) => result.push(r));

      const e1 = new Emitter<number>();
      const l1 = m.add(e1.event);

      deepStrictEqual(result, []);

      e1.fire(0);
      deepStrictEqual(result, [0]);

      l1.dispose();
      deepStrictEqual(result, [0]);

      e1.fire(0);
      deepStrictEqual(result, [0]);
    });

    test('hot start works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();
      m.event((r) => result.push(r));

      const e1 = new Emitter<number>();
      m.add(e1.event);
      const e2 = new Emitter<number>();
      m.add(e2.event);
      const e3 = new Emitter<number>();
      m.add(e3.event);

      e1.fire(1);
      e2.fire(2);
      e3.fire(3);
      deepStrictEqual(result, [1, 2, 3]);
    });

    test('cold start works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();

      const e1 = new Emitter<number>();
      m.add(e1.event);
      const e2 = new Emitter<number>();
      m.add(e2.event);
      const e3 = new Emitter<number>();
      m.add(e3.event);

      m.event((r) => result.push(r));

      e1.fire(1);
      e2.fire(2);
      e3.fire(3);
      deepStrictEqual(result, [1, 2, 3]);
    });

    test('late add works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();

      const e1 = new Emitter<number>();
      m.add(e1.event);
      const e2 = new Emitter<number>();
      m.add(e2.event);

      m.event((r) => result.push(r));

      e1.fire(1);
      e2.fire(2);

      const e3 = new Emitter<number>();
      m.add(e3.event);
      e3.fire(3);

      deepStrictEqual(result, [1, 2, 3]);
    });

    test('add dispose works', () => {
      const result: number[] = [];
      const m = new EventMultiplexer<number>();

      const e1 = new Emitter<number>();
      m.add(e1.event);
      const e2 = new Emitter<number>();
      m.add(e2.event);

      m.event((r) => result.push(r));

      e1.fire(1);
      e2.fire(2);

      const e3 = new Emitter<number>();
      const l3 = m.add(e3.event);
      e3.fire(3);
      deepStrictEqual(result, [1, 2, 3]);

      l3.dispose();
      e3.fire(4);
      deepStrictEqual(result, [1, 2, 3]);

      e2.fire(4);
      e1.fire(5);
      deepStrictEqual(result, [1, 2, 3, 4, 5]);
    });
  });

  test('latch', () => {
    const emitter = new Emitter<number>();
    const event = Event.latch(emitter.event);

    const result: number[] = [];
    const listener = event((num) => result.push(num));

    deepStrictEqual(result, []);

    emitter.fire(1);
    deepStrictEqual(result, [1]);

    emitter.fire(2);
    deepStrictEqual(result, [1, 2]);

    emitter.fire(2);
    deepStrictEqual(result, [1, 2]);

    emitter.fire(1);
    deepStrictEqual(result, [1, 2, 1]);

    emitter.fire(1);
    deepStrictEqual(result, [1, 2, 1]);

    emitter.fire(3);
    deepStrictEqual(result, [1, 2, 1, 3]);

    emitter.fire(3);
    deepStrictEqual(result, [1, 2, 1, 3]);

    emitter.fire(3);
    deepStrictEqual(result, [1, 2, 1, 3]);

    listener.dispose();
  });
});
