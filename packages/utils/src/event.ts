/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/event.ts

import { CancellationToken } from './cancellation';
import { Disposable, DisposableStore, IDisposable, combinedDisposable, toDisposable } from './disposable';
import { onUnexpectedError } from './errors';
import { once as onceFn } from './functional';
import { LinkedList } from './linked-list';
import { randomString } from './uuid';

/**
 * 重要备注
 * 由于 vscode 内部的 DisposableStore 有个私有属性导致类型冲突
 * 因此在 event 模块中的 disposables 不再支持传入 DisposableStore 类型
 */

/**
 * To an event a function with one or zero parameters
 * can be subscribed. The event is the subscriber function itself.
 */
export type Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]) => IDisposable;

export namespace Event {
  const _disposable = { dispose() {} };
  export const None: Event<any> = function () {
    return _disposable;
  };

  /**
   * Given an event, returns another event which only fires once.
   */
  export function once<T>(event: Event<T>): Event<T> {
    return (listener, thisArgs = null, disposables?) => {
      // we need this, in case the event fires during the listener call
      let didFire = false;
      const result = event(
        (e) => {
          if (didFire) {
            return;
          } else if (result) {
            result.dispose();
          } else {
            didFire = true;
          }

          return listener.call(thisArgs, e);
        },
        null,
        disposables,
      );

      if (didFire) {
        result.dispose();
      }

      return result;
    };
  }

  /**
   * Given an event and a `map` function, returns another event which maps each element
   * throught the mapping function.
   */
  export function map<I, O>(event: Event<I>, map: (i: I) => O): Event<O> {
    return snapshot((listener, thisArgs = null, disposables?) =>
      event((i) => listener.call(thisArgs, map(i)), null, disposables),
    );
  }

  /**
   * Given an event and an `each` function, returns another identical event and calls
   * the `each` function per each element.
   */
  export function forEach<I>(event: Event<I>, each: (i: I) => void): Event<I> {
    return snapshot((listener, thisArgs = null, disposables?) =>
      event(
        (i) => {
          each(i);
          listener.call(thisArgs, i);
        },
        null,
        disposables,
      ),
    );
  }

  /**
   * Given an event and a `filter` function, returns another event which emits those
   * elements for which the `filter` function returns `true`.
   */
  export function filter<T>(event: Event<T>, filter: (e: T) => boolean): Event<T>;
  export function filter<T, R>(event: Event<T | R>, filter: (e: T | R) => e is R): Event<R>;
  export function filter<T>(event: Event<T>, filter: (e: T) => boolean): Event<T> {
    return snapshot((listener, thisArgs = null, disposables?) =>
      event((e) => filter(e) && listener.call(thisArgs, e), null, disposables),
    );
  }

  /**
   * Given an event, returns the same event but typed as `Event<void>`.
   */
  export function signal<T>(event: Event<T>): Event<void> {
    return event as Event<any> as Event<void>;
  }

  /**
   * Given a collection of events, returns a single event which emits
   * whenever any of the provided events emit.
   */
  export function any<T>(...events: Event<T>[]): Event<T> {
    return (listener, thisArgs = null, disposables?) =>
      combinedDisposable(events.map((event) => event((e) => listener.call(thisArgs, e), null, disposables)));
  }

  /**
   * Given an event and a `merge` function, returns another event which maps each element
   * and the cummulative result throught the `merge` function. Similar to `map`, but with memory.
   */
  export function reduce<I, O>(event: Event<I>, merge: (last: O | undefined, event: I) => O, initial?: O): Event<O> {
    let output: O | undefined = initial;

    return map<I, O>(event, (e) => {
      output = merge(output, e);
      return output;
    });
  }

  /**
   * Given a chain of event processing functions (filter, map, etc), each
   * function will be invoked per event & per listener. Snapshotting an event
   * chain allows each function to be invoked just once per event.
   */
  export function snapshot<T>(event: Event<T>): Event<T> {
    let listener: IDisposable;
    const emitter = new Emitter<T>({
      onFirstListenerAdd() {
        listener = event(emitter.fire, emitter);
      },
      onLastListenerRemove() {
        listener.dispose();
      },
    });

    return emitter.event;
  }

  /**
   * Debounces the provided event, given a `merge` function.
   *
   * @param event The input event.
   * @param merge The reducing function.
   * @param delay The debouncing delay in millis.
   * @param leading Whether the event should fire in the leading phase of the timeout.
   * @param leakWarningThreshold The leak warning threshold override.
   */
  export function debounce<T>(
    event: Event<T>,
    merge: (last: T | undefined, event: T) => T,
    delay?: number,
    leading?: boolean,
    leakWarningThreshold?: number,
  ): Event<T>;
  export function debounce<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay?: number,
    leading?: boolean,
    leakWarningThreshold?: number,
  ): Event<O>;
  export function debounce<I, O>(
    event: Event<I>,
    merge: (last: O | undefined, event: I) => O,
    delay = 100,
    leading = false,
    leakWarningThreshold?: number,
  ): Event<O> {
    let subscription: IDisposable;
    let output: O | undefined;
    let handle: any;
    let numDebouncedCalls = 0;

    const emitter = new Emitter<O>({
      leakWarningThreshold,
      onFirstListenerAdd() {
        subscription = event((cur) => {
          numDebouncedCalls++;
          output = merge(output, cur);

          if (leading && !handle) {
            emitter.fire(output);
          }

          clearTimeout(handle);
          handle = setTimeout(() => {
            const _output = output;
            output = undefined;
            handle = undefined;
            if (!leading || numDebouncedCalls > 1) {
              emitter.fire(_output!);
            }

            numDebouncedCalls = 0;
          }, delay);
        });
      },
      onLastListenerRemove() {
        subscription.dispose();
      },
    });

    return emitter.event;
  }

  /**
   * Given an event, it returns another event which fires only once and as soon as
   * the input event emits. The event data is the number of millis it took for the
   * event to fire.
   */
  export function stopwatch<T>(event: Event<T>): Event<number> {
    const start = new Date().getTime();
    return map(once(event), (_) => new Date().getTime() - start);
  }

  /**
   * Given an event, it returns another event which fires only when the event
   * element changes.
   */
  export function latch<T>(event: Event<T>): Event<T> {
    let firstCall = true;
    let cache: T;

    return filter(event, (value) => {
      const shouldEmit = firstCall || value !== cache;
      firstCall = false;
      cache = value;
      return shouldEmit;
    });
  }

  /**
   * Buffers the provided event until a first listener comes
   * along, at which point fire all the events at once and
   * pipe the event from then on.
   *
   * ```typescript
   * const emitter = new Emitter<number>();
   * const event = emitter.event;
   * const bufferedEvent = buffer(event);
   *
   * emitter.fire(1);
   * emitter.fire(2);
   * emitter.fire(3);
   * // nothing...
   *
   * const listener = bufferedEvent(num => console.log(num));
   * // 1, 2, 3
   *
   * emitter.fire(4);
   * // 4
   * ```
   */
  export function buffer<T>(event: Event<T>, nextTick = false, _buffer: T[] = []): Event<T> {
    let buffer: T[] | null = _buffer.slice();

    let listener: IDisposable | null = event((e) => {
      if (buffer) {
        buffer.push(e);
      } else {
        emitter.fire(e);
      }
    });

    const flush = () => {
      if (buffer) {
        buffer.forEach((e) => emitter.fire(e));
      }
      buffer = null;
    };

    const emitter = new Emitter<T>({
      onFirstListenerAdd() {
        if (!listener) {
          listener = event((e) => emitter.fire(e));
        }
      },

      onFirstListenerDidAdd() {
        if (buffer) {
          if (nextTick) {
            setTimeout(flush);
          } else {
            flush();
          }
        }
      },

      onLastListenerRemove() {
        if (listener) {
          listener.dispose();
        }
        listener = null;
      },
    });

    return emitter.event;
  }

  export interface IChainableEvent<T> {
    event: Event<T>;
    map<O>(fn: (i: T) => O): IChainableEvent<O>;
    forEach(fn: (i: T) => void): IChainableEvent<T>;
    filter(fn: (e: T) => boolean): IChainableEvent<T>;
    reduce<R>(merge: (last: R | undefined, event: T) => R, initial?: R): IChainableEvent<R>;
    latch(): IChainableEvent<T>;
    on(listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable;
    once(listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]): IDisposable;
  }

  class ChainableEvent<T> implements IChainableEvent<T> {
    constructor(readonly event: Event<T>) {}

    map<O>(fn: (i: T) => O): IChainableEvent<O> {
      return new ChainableEvent(map(this.event, fn));
    }

    forEach(fn: (i: T) => void): IChainableEvent<T> {
      return new ChainableEvent(forEach(this.event, fn));
    }

    filter(fn: (e: T) => boolean): IChainableEvent<T> {
      return new ChainableEvent(filter(this.event, fn));
    }

    reduce<R>(merge: (last: R | undefined, event: T) => R, initial?: R): IChainableEvent<R> {
      return new ChainableEvent(reduce(this.event, merge, initial));
    }

    latch(): IChainableEvent<T> {
      return new ChainableEvent(latch(this.event));
    }

    on(listener: (e: T) => any, thisArgs: any, disposables: IDisposable[]) {
      return this.event(listener, thisArgs, disposables);
    }

    once(listener: (e: T) => any, thisArgs: any, disposables: IDisposable[]) {
      return once(this.event)(listener, thisArgs, disposables);
    }
  }

  export function chain<T, R>(
    event: Event<T>,
    sythensize: ($: IChainableSythensis<T>) => IChainableSythensis<R>,
  ): Event<R> {
    const fn: Event<R> = (listener, thisArgs, disposables) => {
      const cs = sythensize(new ChainableSynthesis()) as ChainableSynthesis;
      return event(
        function (value) {
          const result = cs.evaluate(value);
          if (result !== HaltChainable) {
            listener.call(thisArgs, result);
          }
        },
        undefined,
        disposables,
      );
    };

    return fn;
  }

  const HaltChainable = Symbol('HaltChainable');

  class ChainableSynthesis implements IChainableSythensis<any> {
    private readonly steps: ((input: any) => any)[] = [];

    map<O>(fn: (i: any) => O): this {
      this.steps.push(fn);
      return this;
    }

    forEach(fn: (i: any) => void): this {
      this.steps.push((v) => {
        fn(v);
        return v;
      });
      return this;
    }

    filter(fn: (e: any) => boolean): this {
      this.steps.push((v) => (fn(v) ? v : HaltChainable));
      return this;
    }

    reduce<R>(merge: (last: R | undefined, event: any) => R, initial?: R | undefined): this {
      let last = initial;
      this.steps.push((v) => {
        last = merge(last, v);
        return last;
      });
      return this;
    }

    latch(equals: (a: any, b: any) => boolean = (a, b) => a === b): ChainableSynthesis {
      let firstCall = true;
      let cache: any;
      this.steps.push((value) => {
        const shouldEmit = firstCall || !equals(value, cache);
        firstCall = false;
        cache = value;
        return shouldEmit ? value : HaltChainable;
      });

      return this;
    }

    public evaluate(value: any) {
      for (const step of this.steps) {
        value = step(value);
        if (value === HaltChainable) {
          break;
        }
      }

      return value;
    }
  }

  export interface IChainableSythensis<T> {
    map<O>(fn: (i: T) => O): IChainableSythensis<O>;
    forEach(fn: (i: T) => void): IChainableSythensis<T>;
    filter<R extends T>(fn: (e: T) => e is R): IChainableSythensis<R>;
    filter(fn: (e: T) => boolean): IChainableSythensis<T>;
    reduce<R>(merge: (last: R, event: T) => R, initial: R): IChainableSythensis<R>;
    reduce<R>(merge: (last: R | undefined, event: T) => R): IChainableSythensis<R>;
    latch(equals?: (a: T, b: T) => boolean): IChainableSythensis<T>;
  }

  export interface NodeEventEmitter {
    on(event: string | symbol, listener: Function): this;
    removeListener(event: string | symbol, listener: Function): this;
  }

  export function fromNodeEventEmitter<T>(
    emitter: NodeEventEmitter,
    eventName: string,
    map: (...args: any[]) => T = (id) => id,
  ): Event<T> {
    const fn = (...args: any[]) => result.fire(map(...args));
    const onFirstListenerAdd = () => emitter.on(eventName, fn);
    const onLastListenerRemove = () => emitter.removeListener(eventName, fn);
    const result = new Emitter<T>({ onFirstListenerAdd, onLastListenerRemove });

    return result.event;
  }

  export function fromPromise<T = any>(promise: Promise<T>): Event<undefined> {
    const emitter = new Emitter<undefined>();
    let shouldEmit = false;

    promise
      .then(undefined, () => null)
      .then(() => {
        if (!shouldEmit) {
          setTimeout(() => emitter.fire(undefined), 0);
        } else {
          emitter.fire(undefined);
        }
      });

    shouldEmit = true;
    return emitter.event;
  }

  export function toPromise<T>(event: Event<T>): Promise<T> {
    return new Promise((c) => once(event)(c));
  }
}

type Listener<T> = [(e: T) => void, any] | ((e: T) => void);

export interface EmitterOptions {
  onFirstListenerAdd?: Function;
  onFirstListenerDidAdd?: Function;
  onListenerDidAdd?: Function;
  onLastListenerRemove?: Function;
  leakWarningThreshold?: number;
}

let _globalLeakWarningThreshold = -1;
export function setGlobalLeakWarningThreshold(n: number): IDisposable {
  const oldValue = _globalLeakWarningThreshold;
  _globalLeakWarningThreshold = n;
  return {
    dispose() {
      _globalLeakWarningThreshold = oldValue;
    },
  };
}

class LeakageMonitor {
  private _stacks: Map<string, number> | undefined;
  private _warnCountdown = 0;

  constructor(readonly customThreshold?: number, readonly name: string = randomString(3)) {}

  dispose(): void {
    if (this._stacks) {
      this._stacks.clear();
    }
  }

  check(listenerCount: number): undefined | (() => void) {
    let threshold = _globalLeakWarningThreshold;
    if (typeof this.customThreshold === 'number') {
      threshold = this.customThreshold;
    }

    if (threshold <= 0 || listenerCount < threshold) {
      return undefined;
    }

    if (!this._stacks) {
      this._stacks = new Map();
    }
    const stack = new Error().stack!.split('\n').slice(3).join('\n');
    const count = this._stacks.get(stack) || 0;
    this._stacks.set(stack, count + 1);
    this._warnCountdown -= 1;

    if (this._warnCountdown <= 0) {
      // only warn on first exceed and then every time the limit
      // is exceeded by 50% again
      this._warnCountdown = threshold * 0.5;

      // find most frequent listener and print warning
      let topStack = '';
      let topCount = 0;
      this._stacks.forEach((count, stack) => {
        if (!topStack || topCount < count) {
          topStack = stack;
          topCount = count;
        }
      });

      // eslint-disable-next-line no-console
      console.warn(
        `[${this.name}] potential listener LEAK detected, having ${listenerCount} listeners already. MOST frequent listener (${topCount}):`,
      );
      // eslint-disable-next-line no-console
      console.warn(topStack);
    }

    return () => {
      const count = this._stacks!.get(stack) || 0;
      this._stacks!.set(stack, count - 1);
    };
  }
}

/**
 * The Emitter can be used to expose an Event to the public
 * to fire it from the insides.
 * Sample:
  class Document {

    private _onDidChange = new Emitter<(value:string)=>any>();

    public onDidChange = this._onDidChange.event;

    // getter-style
    // get onDidChange(): Event<(value:string)=>any> {
    // 	return this._onDidChange.event;
    // }

    private _doIt() {
      //...
      this._onDidChange.fire(value);
    }
  }
 */

export interface IAsyncResult<T> {
  err?: Error;
  result?: T;
}
export class Emitter<T> {
  private static readonly _noop = function () {};

  private readonly _options?: EmitterOptions;
  private readonly _leakageMon?: LeakageMonitor;
  private _disposed = false;
  private _event?: Event<T>;
  private _deliveryQueue?: LinkedList<[Listener<T>, T]>;
  protected _listeners?: LinkedList<Listener<T>>;

  constructor(options?: EmitterOptions) {
    this._options = options;
    this._leakageMon =
      _globalLeakWarningThreshold > 0
        ? new LeakageMonitor(this._options && this._options.leakWarningThreshold)
        : undefined;
  }

  /**
   * For the public to allow to subscribe
   * to events from this Emitter
   */
  get event(): Event<T> {
    if (!this._event) {
      this._event = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]) => {
        if (!this._listeners) {
          this._listeners = new LinkedList();
        }

        const firstListener = this._listeners.isEmpty();

        if (firstListener && this._options && this._options.onFirstListenerAdd) {
          this._options.onFirstListenerAdd(this);
        }

        const remove = this._listeners.push(!thisArgs ? listener : [listener, thisArgs]);

        if (firstListener && this._options && this._options.onFirstListenerDidAdd) {
          this._options.onFirstListenerDidAdd(this);
        }

        if (this._options && this._options.onListenerDidAdd) {
          this._options.onListenerDidAdd(this, listener, thisArgs);
        }

        // check and record this emitter for potential leakage
        let removeMonitor: (() => void) | undefined;
        if (this._leakageMon) {
          removeMonitor = this._leakageMon.check(this._listeners.size);
        }

        let result: IDisposable;
        result = {
          dispose: () => {
            if (removeMonitor) {
              removeMonitor();
            }
            result.dispose = Emitter._noop;
            if (!this._disposed) {
              remove();
              if (this._options && this._options.onLastListenerRemove) {
                const hasListeners = this._listeners && !this._listeners.isEmpty();
                if (!hasListeners) {
                  this._options.onLastListenerRemove(this);
                }
              }
            }
          },
        };
        if (disposables instanceof DisposableStore) {
          disposables.add(result);
        } else if (Array.isArray(disposables)) {
          disposables.push(result);
        }

        return result;
      };
    }
    return this._event;
  }

  /**
   * To be kept private to fire an event to
   * subscribers
   */
  fire(event: T): void {
    if (this._listeners) {
      // put all [listener,event]-pairs into delivery queue
      // then emit all event. an inner/nested event might be
      // the driver of this

      if (!this._deliveryQueue) {
        this._deliveryQueue = new LinkedList();
      }

      for (let iter = this._listeners.iterator(), e = iter.next(); !e.done; e = iter.next()) {
        this._deliveryQueue.push([e.value, event]);
      }

      while (this._deliveryQueue.size > 0) {
        const [listener, event] = this._deliveryQueue.shift()!;
        try {
          if (typeof listener === 'function') {
            listener.call(undefined, event);
          } else {
            listener[0].call(listener[1], event);
          }
        } catch (e) {
          onUnexpectedError(e);
        }
      }
    }
  }

  /**
   * 发送一个异步事件，等待所有监听器返回，并收集返回值
   * @param e
   * @param timeout
   */
  async fireAndAwait<R = any>(event: T, timeout = 2000): Promise<Array<IAsyncResult<R>>> {
    if (this._listeners) {
      if (!this._deliveryQueue) {
        this._deliveryQueue = new LinkedList();
      }

      for (let iter = this._listeners.iterator(), e = iter.next(); !e.done; e = iter.next()) {
        this._deliveryQueue.push([e.value, event]);
      }

      const promises: Promise<IAsyncResult<R>>[] = [];

      const timeoutPromise = new Promise<IAsyncResult<R>>((resolve) => {
        setTimeout(() => {
          resolve({
            err: new Error('timeout'),
          });
        }, timeout);
      });
      while (this._deliveryQueue.size > 0) {
        const [listener, event] = this._deliveryQueue.shift()!;
        try {
          const promise: Promise<IAsyncResult<R>> = (async () => {
            try {
              if (typeof listener === 'function') {
                return {
                  result: (await listener.call(undefined, event)) as any,
                };
              } else {
                return {
                  result: (await listener[0].call(listener[1], event)) as any,
                };
              }
            } catch (e) {
              return {
                err: e,
              };
            }
          })();
          promises.push(Promise.race([timeoutPromise, promise]));
        } catch (e) {
          onUnexpectedError(e);
        }
      }
      return Promise.all(promises);
    } else {
      return [];
    }
  }

  get listenerSize() {
    return this._listeners ? this._listeners.size : 0;
  }

  dispose() {
    if (this._listeners) {
      this._listeners.clear();
    }
    if (this._deliveryQueue) {
      this._deliveryQueue.clear();
    }
    if (this._leakageMon) {
      this._leakageMon.dispose();
    }
    this._disposed = true;
  }
}

export class PauseableEmitter<T> extends Emitter<T> {
  private _isPaused = 0;
  private _eventQueue = new LinkedList<T>();
  private _mergeFn?: (input: T[]) => T;

  constructor(options?: EmitterOptions & { merge?: (input: T[]) => T }) {
    super(options);
    this._mergeFn = options && options.merge;
  }

  pause(): void {
    this._isPaused++;
  }

  resume(): void {
    if (this._isPaused !== 0 && --this._isPaused === 0) {
      if (this._mergeFn) {
        // use the merge function to create a single composite
        // event. make a copy in case firing pauses this emitter
        const events = this._eventQueue.toArray();
        this._eventQueue.clear();
        super.fire(this._mergeFn(events));
      } else {
        // no merging, fire each event individually and test
        // that this emitter isn't paused halfway through
        while (!this._isPaused && this._eventQueue.size !== 0) {
          super.fire(this._eventQueue.shift()!);
        }
      }
    }
  }

  fire(event: T): void {
    if (this._listeners) {
      if (this._isPaused !== 0) {
        this._eventQueue.push(event);
      } else {
        super.fire(event);
      }
    }
  }
}

export interface WaitUntilEvent {
  waitUntil?(thenable: Promise<any>): void;
}
export namespace WaitUntilEvent {
  export async function fire<T extends WaitUntilEvent>(
    emitter: Emitter<T>,
    event: Pick<T, Exclude<keyof T, 'waitUntil'>>,
    timeout: number | undefined = undefined,
  ): Promise<void> {
    const waitables: Promise<void>[] = [];
    const asyncEvent = Object.assign(event, {
      waitUntil: (thenable: Promise<any>) => {
        if (Object.isFrozen(waitables)) {
          throw new Error('waitUntil cannot be called asynchronously.');
        }
        waitables.push(thenable);
      },
    }) as T;
    emitter.fire(asyncEvent);
    // Asynchronous calls to `waitUntil` should fail.
    Object.freeze(waitables);
    // ts 要求 delete 的属性是 optional
    delete asyncEvent.waitUntil;
    if (!waitables.length) {
      return;
    }
    if (timeout !== undefined) {
      await Promise.race([Promise.all(waitables), new Promise((resolve) => setTimeout(resolve, timeout))]);
    } else {
      await Promise.all(waitables);
    }
  }
}

export class AsyncEmitter<T extends WaitUntilEvent> extends Emitter<T> {
  private _asyncDeliveryQueue?: LinkedList<[Listener<T>, Omit<T, 'waitUntil'>]>;

  async fireAsync(
    data: Omit<T, 'waitUntil'>,
    token: CancellationToken,
    promiseJoin?: (p: Promise<any>, listener: Function) => Promise<any>,
  ): Promise<void> {
    if (!this._listeners) {
      return;
    }

    if (!this._asyncDeliveryQueue) {
      this._asyncDeliveryQueue = new LinkedList();
    }

    for (let iter = this._listeners.iterator(), e = iter.next(); !e.done; e = iter.next()) {
      this._asyncDeliveryQueue.push([e.value, data]);
    }

    while (this._asyncDeliveryQueue.size > 0 && !token.isCancellationRequested) {
      const [listener, data] = this._asyncDeliveryQueue.shift()!;
      const thenables: Promise<any>[] = [];

      const event = {
        ...data,
        waitUntil: (p: Promise<any>): void => {
          if (Object.isFrozen(thenables)) {
            throw new Error('waitUntil can NOT be called asynchronous');
          }
          if (promiseJoin) {
            p = promiseJoin(p, typeof listener === 'function' ? listener : listener[0]);
          }
          thenables.push(p);
        },
      } as T;

      try {
        if (typeof listener === 'function') {
          listener.call(undefined, event);
        } else {
          listener[0].call(listener[1], event);
        }
      } catch (e) {
        onUnexpectedError(e);
        continue;
      }

      // freeze thenables-collection to enforce sync-calls to
      // wait until and then wait for all thenables to resolve
      Object.freeze(thenables);
      await Promise.all(
        // Promise.allSettled 只有 core-js3 才支持，先手动加 catch 处理下
        thenables.map((thenable) => thenable.catch((e) => e)),
      ).catch((e) => onUnexpectedError(e));
    }
  }
}

export class EventMultiplexer<T> implements IDisposable {
  private readonly emitter: Emitter<T>;
  private hasListeners = false;
  private events: { event: Event<T>; listener: IDisposable | null }[] = [];

  constructor() {
    this.emitter = new Emitter<T>({
      onFirstListenerAdd: () => this.onFirstListenerAdd(),
      onLastListenerRemove: () => this.onLastListenerRemove(),
    });
  }

  get event(): Event<T> {
    return this.emitter.event;
  }

  add(event: Event<T>): IDisposable {
    const e = { event, listener: null };
    this.events.push(e);

    if (this.hasListeners) {
      this.hook(e);
    }

    const dispose = () => {
      if (this.hasListeners) {
        this.unhook(e);
      }

      const idx = this.events.indexOf(e);
      this.events.splice(idx, 1);
    };

    return toDisposable(onceFn(dispose));
  }

  private onFirstListenerAdd(): void {
    this.hasListeners = true;
    this.events.forEach((e) => this.hook(e));
  }

  private onLastListenerRemove(): void {
    this.hasListeners = false;
    this.events.forEach((e) => this.unhook(e));
  }

  private hook(e: { event: Event<T>; listener: IDisposable | null }): void {
    e.listener = e.event((r) => this.emitter.fire(r));
  }

  private unhook(e: { event: Event<T>; listener: IDisposable | null }): void {
    if (e.listener) {
      e.listener.dispose();
    }
    e.listener = null;
  }

  dispose(): void {
    this.emitter.dispose();
  }
}

/**
 * The EventBufferer is useful in situations in which you want
 * to delay firing your events during some code.
 * You can wrap that code and be sure that the event will not
 * be fired during that wrap.
 *
 * ```
 * const emitter: Emitter;
 * const delayer = new EventDelayer();
 * const delayedEvent = delayer.wrapEvent(emitter.event);
 *
 * delayedEvent(console.log);
 *
 * delayer.bufferEvents(() => {
 *   emitter.fire(); // event will not be fired yet
 * });
 *
 * // event will only be fired at this point
 * ```
 */
export class EventBufferer {
  private buffers: Function[][] = [];

  wrapEvent<T>(event: Event<T>): Event<T> {
    return (listener, thisArgs?, disposables?) =>
      event(
        (i) => {
          const buffer = this.buffers[this.buffers.length - 1];

          if (buffer) {
            buffer.push(() => listener.call(thisArgs, i));
          } else {
            listener.call(thisArgs, i);
          }
        },
        undefined,
        disposables,
      );
  }

  bufferEvents<R = void>(fn: () => R): R {
    const buffer: Array<() => R> = [];
    this.buffers.push(buffer);
    const r = fn();
    this.buffers.pop();
    buffer.forEach((flush) => flush());
    return r;
  }
}

/**
 * A Relay is an event forwarder which functions as a replugabble event pipe.
 * Once created, you can connect an input event to it and it will simply forward
 * events from that input event through its own `event` property. The `input`
 * can be changed at any point in time.
 */
export class Relay<T> implements IDisposable {
  private listening = false;
  private inputEvent: Event<T> = Event.None;
  private inputEventListener: IDisposable = Disposable.None;

  private emitter = new Emitter<T>({
    onFirstListenerDidAdd: () => {
      this.listening = true;
      this.inputEventListener = this.inputEvent(this.emitter.fire, this.emitter);
    },
    onLastListenerRemove: () => {
      this.listening = false;
      this.inputEventListener.dispose();
    },
  });

  readonly event: Event<T> = this.emitter.event;

  set input(event: Event<T>) {
    this.inputEvent = event;

    if (this.listening) {
      this.inputEventListener.dispose();
      this.inputEventListener = event(this.emitter.fire, this.emitter);
    }
  }

  dispose() {
    this.inputEventListener.dispose();
    this.emitter.dispose();
  }
}

/**
 * 同步执行的 Ready， 对 ready 的实时响应比 promise 快，多用在需要快速响应初始化回调的场景
 */
export class ReadyEvent<T = void> implements IDisposable {
  private _isReady = false;

  private _param: T | undefined = undefined;

  private _emitter = new Emitter<T>();

  onceReady(cb: (param: T) => any): Promise<any> {
    if (this._isReady) {
      try {
        return Promise.resolve(cb(this._param!));
      } catch (e) {
        return Promise.reject(e);
      }
    } else {
      return new Promise<any>((resolve, reject) => {
        this._emitter.event((param) => {
          try {
            resolve(cb(param));
          } catch (e) {
            reject(e);
          }
        });
      });
    }
  }

  ready(param: T) {
    if (!this._isReady) {
      this._isReady = true;
      this._param = param;
    }
    this._emitter.fire(param);
    this._emitter.dispose();
    this._emitter = null as any;
  }

  dispose() {
    if (this._emitter) {
      this._emitter.dispose();
    }
  }
}

export class Dispatcher<T = void> implements IDisposable {
  private _emitter = new Emitter<{
    type: string;
    data: T;
  }>();

  on(type: string): Event<T> {
    return Event.map(
      Event.filter(this._emitter.event, (e) => e.type === type),
      (v) => v.data,
    );
  }

  dispatch(type: string, data: T) {
    this._emitter.fire({
      type,
      data,
    });
  }

  dispose(): void {
    this._emitter.dispose();
  }
}

export class EventQueue<T> {
  protected _listeners = new LinkedList<(data: T) => void>();

  protected queue: T[] = [];

  isOpened = false;
  open = () => {
    this.isOpened = true;
    this.queue.forEach((data) => {
      this.fire(data);
    });
    this.queue = [];
  };

  close = () => {
    this.isOpened = false;
  };

  push = (data: T) => {
    if (this.isOpened) {
      this.fire(data);
    } else {
      this.queue.push(data);
    }
  };

  fire = (data: T) => {
    this._listeners.forEach((listener) => {
      listener(data);
    });
  };

  on = (cb: (data: T) => void) => {
    const toRemove = this._listeners.push(cb);

    if (!this.isOpened) {
      this.open();
    }

    return Disposable.create(() => {
      toRemove();
      if (this._listeners.size === 0) {
        this.close();
      }
    });
  };

  dispose = () => {
    this._listeners.clear();
  };
}
