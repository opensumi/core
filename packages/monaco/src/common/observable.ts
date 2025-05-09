// @ts-nocheck
import { autorun, autorunOpts } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/autorun';
import {
  IObservable,
  IObserver,
  IReader,
  observableValue,
  transaction,
} from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/commonFacade/deps';
import { derived } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/derived';
import { observableFromEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/utils';

export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/autorun';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/debugName';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/derived';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/logging';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/utils';

export function autorunDelta<T>(
  observable: IObservable<T>,
  handler: (args: { lastValue: T | undefined; newValue: T }, reader: IReader) => void,
): IDisposable {
  let _lastValue: T | undefined;
  return autorunOpts({ debugReferenceFn: handler }, (reader) => {
    const newValue = observable.read(reader);
    const lastValue = _lastValue;
    _lastValue = newValue;
    handler({ lastValue, newValue }, reader);
  });
}

export function debouncedObservable2<T>(observable: IObservable<T>, debounceMs: number): IObservable<T> {
  let hasValue = false;
  let lastValue: T | undefined;

  let timeout: any;

  return observableFromEvent<T, void>(
    (cb) => {
      const d = autorun((reader) => {
        const value = observable.read(reader);

        if (!hasValue) {
          hasValue = true;
          lastValue = value;
        } else {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => {
            lastValue = value;
            cb();
          }, debounceMs);
        }
      });
      return {
        dispose() {
          d.dispose();
          hasValue = false;
          lastValue = undefined;
        },
      };
    },
    () => {
      if (hasValue) {
        return lastValue!;
      } else {
        return observable.get();
      }
    },
  );
}

export function onObservableChange<T>(observable: IObservable<unknown, T>, callback: (value: T) => void): IDisposable {
  const o: IObserver = {
    beginUpdate() {},
    endUpdate() {},
    handlePossibleChange(observable) {
      observable.reportChanges();
    },
    handleChange<T2, TChange>(_observable: IObservable<T2, TChange>) {
      callback(_observable.get() as unknown as T);
    },
  };

  observable.addObserver(o);
  return {
    dispose() {
      observable.removeObserver(o);
    },
  };
}

export class ObservableLazy<T> {
  private readonly _value = observableValue<T | undefined>(this, undefined);

  /**
   * The cached value.
   * Does not force a computation of the value.
   */
  public get cachedValue(): IObservable<T | undefined> {
    return this._value;
  }

  constructor(private readonly _computeValue: () => T) {}

  /**
   * Returns the cached value.
   * Computes the value if the value has not been cached yet.
   */
  public getValue() {
    let v = this._value.get();
    if (!v) {
      v = this._computeValue();
      this._value.set(v, undefined);
    }
    return v;
  }
}

/**
 * A promise whose state is observable.
 */
export class ObservablePromise<T> {
  public static fromFn<T>(fn: () => Promise<T>): ObservablePromise<T> {
    return new ObservablePromise(fn());
  }

  private readonly _value = observableValue<PromiseResult<T> | undefined>(this, undefined);

  /**
   * The promise that this object wraps.
   */
  public readonly promise: Promise<T>;

  /**
   * The current state of the promise.
   * Is `undefined` if the promise didn't resolve yet.
   */
  public readonly promiseResult: IObservable<PromiseResult<T> | undefined> = this._value;

  constructor(promise: Promise<T>) {
    this.promise = promise.then(
      (value) => {
        // TODO: 只有一次更新，有必要上tx吗？
        transaction((tx) => {
          /** @description onPromiseResolved */
          this._value.set(new PromiseResult(value, undefined), tx);
        });
        return value;
      },
      (error) => {
        transaction((tx) => {
          /** @description onPromiseRejected */
          this._value.set(new PromiseResult<T>(undefined, error), tx);
        });
        throw error;
      },
    );
  }
}

export class PromiseResult<T> {
  constructor(
    /**
     * The value of the resolved promise.
     * Undefined if the promise rejected.
     */
    public readonly data: T | undefined,

    /**
     * The error in case of a rejected promise.
     * Undefined if the promise resolved.
     */
    public readonly error: unknown | undefined,
  ) {}

  /**
   * Returns the value if the promise resolved, otherwise throws the error.
   */
  public getDataOrThrow(): T {
    if (this.error) {
      throw this.error;
    }
    return this.data!;
  }
}

/**
 * A lazy promise whose state is observable.
 */
export class ObservableLazyPromise<T> {
  private readonly _lazyValue = new ObservableLazy(() => new ObservablePromise(this._computePromise()));

  /**
   * Does not enforce evaluation of the promise compute function.
   * Is undefined if the promise has not been computed yet.
   */
  public readonly cachedPromiseResult = derived(this, (reader) =>
    this._lazyValue.cachedValue.read(reader)?.promiseResult.read(reader),
  );

  constructor(private readonly _computePromise: () => Promise<T>) {}

  public getPromise(): Promise<T> {
    return this._lazyValue.getValue().promise;
  }
}
