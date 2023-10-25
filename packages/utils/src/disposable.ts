/** ******************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import { MaybePromise } from './async';
import { Event, Emitter } from './event';

export class DisposableStore implements IDisposable {
  private toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  /**
   * Dispose of all registered disposables and mark this object as disposed.
   *
   * Any future disposables added to this object will be disposed of on `add`.
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    markTracked(this);
    this._isDisposed = true;
    this.clear();
  }

  /**
   * Dispose of all registered disposables but do not mark this object as disposed.
   */
  public clear(): void {
    this.toDispose.forEach((item) => item.dispose());
    this.toDispose.clear();
  }

  public add<T extends IDisposable>(t: T): T {
    if (!t) {
      return t;
    }
    if ((t as any as DisposableStore) === this) {
      throw new Error('Cannot register a disposable on itself!');
    }

    markTracked(t);
    if (this._isDisposed) {
      // eslint-disable-next-line no-console
      console.warn(new Error('Registering disposable on object that has already been disposed of').stack);
      t.dispose();
    } else {
      this.toDispose.add(t);
    }

    return t;
  }
}

export interface IDisposable {
  /**
   * Dispose this object.
   */
  dispose(): void;
}

export function isDisposable<E extends object>(thing: E): thing is E & IDisposable {
  return typeof (thing as IDisposable).dispose === 'function' && (thing as IDisposable).dispose.length === 0;
}

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(...disposables: Array<T | undefined>): T[];
export function dispose<T extends IDisposable>(disposables: T[]): T[];
export function dispose<T extends IDisposable>(first: T | T[], ...rest: T[]): T | T[] | undefined {
  if (Array.isArray(first)) {
    first.forEach((d) => {
      if (d) {
        markTracked(d);
        d.dispose();
      }
    });
    return [];
  } else if (rest.length === 0) {
    if (first) {
      markTracked(first);
      first.dispose();
      return first;
    }
    return undefined;
  } else {
    dispose(first);
    dispose(rest);
    return [];
  }
}

export function combinedDisposable(disposables: IDisposable[]): IDisposable {
  disposables.forEach(markTracked);
  return trackDisposable({ dispose: () => dispose(disposables) });
}

export function toDisposable(fn: () => void): IDisposable {
  return {
    dispose() {
      fn();
    },
  };
}

export class Disposable implements IDisposable {
  protected readonly disposables: IDisposable[] = [];
  protected readonly onDisposeEmitter = new Emitter<void>();

  constructor(...toDispose: IDisposable[]) {
    toDispose.forEach((d) => this.addDispose(d));
  }

  static create(func: () => void): IDisposable {
    return {
      dispose: func,
    };
  }

  static NULL = Disposable.create(() => {});

  static None = Object.freeze<IDisposable>({ dispose() {} });

  get onDispose(): Event<void> {
    return this.onDisposeEmitter.event;
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined);
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0;
  }

  private disposingElements = false;

  dispose(): void {
    if (this.disposed || this.disposingElements) {
      return;
    }
    this.disposingElements = true;
    while (!this.disposed) {
      try {
        this.disposables.pop()!.dispose();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
    this.disposingElements = false;
    this.checkDisposed();
  }

  addDispose(disposable: IDisposable): IDisposable;
  addDispose(disposable: IDisposable[]): IDisposable[];
  addDispose(disposable: IDisposable | IDisposable[]): IDisposable | IDisposable[] {
    if (Array.isArray(disposable)) {
      const disposables = disposable;
      return disposables.map((disposable) => this.addDispose(disposable));
    } else {
      return this.add(disposable);
    }
  }

  protected registerDispose<T extends IDisposable>(disposable: T): T {
    if ((disposable as any as Disposable) === this) {
      throw new Error('Cannot register a disposable on itself!');
    }

    this.add(disposable);
    return disposable;
  }

  private add(disposable: IDisposable): IDisposable {
    const disposables = this.disposables;
    disposables.push(disposable);
    const originalDispose = disposable.dispose.bind(disposable);
    const toRemove = Disposable.create(() => {
      const index = disposables.indexOf(disposable);
      if (index !== -1) {
        disposables.splice(index, 1);
      }
      this.checkDisposed();
    });
    disposable.dispose = () => {
      toRemove.dispose();
      originalDispose();
    };
    return toRemove;
  }
}

export class DisposableCollection implements IDisposable {
  protected readonly disposables: IDisposable[] = [];
  protected readonly onDisposeEmitter = new Emitter<void>();

  constructor(...toDispose: IDisposable[]) {
    toDispose.forEach((d) => this.push(d));
  }

  get onDispose(): Event<void> {
    return this.onDisposeEmitter.event;
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined);
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0;
  }

  private disposingElements = false;
  dispose(): void {
    if (this.disposed || this.disposingElements) {
      return;
    }
    const toPromise = [] as any[];
    this.disposingElements = true;
    while (!this.disposed) {
      try {
        const maybePromise = this.disposables.pop()!.dispose() as MaybePromise<void>;
        if (maybePromise) {
          toPromise.push(maybePromise);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('DisposableCollection.dispose error', e);
      }
    }
    this.disposingElements = false;
    this.checkDisposed();
    return Promise.all(toPromise) as unknown as MaybePromise<void> as void;
  }

  push(disposable: IDisposable): IDisposable {
    const disposables = this.disposables;
    disposables.push(disposable);
    const originalDispose = disposable.dispose.bind(disposable);
    const toRemove = Disposable.create(() => {
      const index = disposables.indexOf(disposable);
      if (index !== -1) {
        disposables.splice(index, 1);
      }
      this.checkDisposed();
    });
    disposable.dispose = () => {
      toRemove.dispose();
      originalDispose();
    };
    return toRemove;
  }

  pushAll(disposables: IDisposable[]): IDisposable[] {
    return disposables.map((disposable) => this.push(disposable));
  }
}

/**
 * Enables logging of potentially leaked disposables.
 *
 * A disposable is considered leaked if it is not disposed or not registered as the child of
 * another disposable. This tracking is very simple an only works for classes that either
 * extend Disposable or use a DisposableStore. This means there are a lot of false positives.
 */
const TRACK_DISPOSABLES = false;

const __is_disposable_tracked__ = '__is_disposable_tracked__';

function markTracked<T extends IDisposable>(x: T): void {
  if (!TRACK_DISPOSABLES) {
    return;
  }

  if (x && x !== Disposable.None) {
    try {
      (x as any)[__is_disposable_tracked__] = true;
    } catch (_e) {
      // noop
    }
  }
}

function trackDisposable<T extends IDisposable>(x: T): T {
  if (!TRACK_DISPOSABLES) {
    return x;
  }

  const stack = new Error('Potentially leaked disposable').stack!;
  setTimeout(() => {
    if (!(x as any)[__is_disposable_tracked__]) {
      // eslint-disable-next-line no-console
      console.log(stack);
    }
  }, 3000);
  return x;
}

/**
 * Manages the lifecycle of a disposable value that may be changed.
 *
 * This ensures that when the the disposable value is changed, the previously held disposable is disposed of. You can
 * also register a `MutableDisposable` on a `Disposable` to ensure it is automatically cleaned up.
 */
export class MutableDisposable<T extends IDisposable> implements IDisposable {
  private _value?: T;
  private _isDisposed = false;

  constructor() {
    trackDisposable(this);
  }

  get value(): T | undefined {
    return this._isDisposed ? undefined : this._value;
  }

  set value(value: T | undefined) {
    if (this._isDisposed || value === this._value) {
      return;
    }

    if (this._value) {
      this._value.dispose();
    }
    if (value) {
      markTracked(value);
    }
    this._value = value;
  }

  clear() {
    this.value = undefined;
  }

  dispose(): void {
    this._isDisposed = true;
    markTracked(this);
    if (this._value) {
      this._value.dispose();
    }
    this._value = undefined;
  }
}

export class RefCountedDisposable {
  private _counter = 1;

  constructor(private readonly _disposable: IDisposable) {}

  acquire() {
    this._counter++;
    return this;
  }

  release() {
    if (--this._counter === 0) {
      this._disposable.dispose();
    }
    return this;
  }
}

export class DisposableMap extends Map<string, IDisposable> implements IDisposable {
  disposeKey(key: string): void {
    const disposable = this.get(key);
    if (disposable) {
      disposable.dispose();
    }
    this.delete(key);
  }

  dispose(): void {
    for (const disposable of this.values()) {
      disposable.dispose();
    }
    this.clear();
  }
}
