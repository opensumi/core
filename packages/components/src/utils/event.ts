// Modify from @opensumi/ide-core-common/src/event.ts
import { IDisposable } from './disposable';
import { LinkedList } from './linkedList';

/**
 * To an event a function with one or zero parameters
 * can be subscribed. The event is the subscriber function itself.
 */
export type Event<T> = (listener: (e: T) => any, thisArgs?: any, disposables?: IDisposable[]) => IDisposable;

export namespace Event {
  const _disposable = { dispose() {} };
  export const None: Event<any> = () => _disposable;

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

  export function chain<T>(event: Event<T>): IChainableEvent<T> {
    return new ChainableEvent(event);
  }

  export interface NodeEventEmitter {
    on(event: string | symbol, listener: () => void): this;
    removeListener(event: string | symbol, listener: () => void): this;
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
  onFirstListenerAdd?: (emitter: Emitter<any>) => void;
  onFirstListenerDidAdd?: (emitter: Emitter<any>) => void;
  onListenerDidAdd?: (emitter: Emitter<any>, listener: (e: any) => any, args: any) => void;
  onLastListenerRemove?: (emitter: Emitter<any>) => void;
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

  constructor(readonly customThreshold?: number, readonly name: string = Math.random().toString(18).slice(2, 5)) {}

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
    //   return this._onDidChange.event;
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
  private static readonly _noop = () => {};

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

        const result = {
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
        } as IDisposable;
        if (Array.isArray(disposables)) {
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
        if (typeof listener === 'function') {
          listener.call(undefined, event);
        } else {
          listener[0].call(listener[1], event);
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
  waitUntil(thenable: Promise<any>): void;
}

export namespace WaitUntilEvent {
  export async function fire<T extends WaitUntilEvent>(
    emitter: Emitter<T>,
    event: Pick<T, Exclude<keyof T, 'waitUntil'>>,
    timeout?: number,
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete asyncEvent['waitUntil'];
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
