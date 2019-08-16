/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { once } from './functional';


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
		} catch {
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
			console.log(stack);
		}
	}, 3000);
	return x;
}

export interface IDisposable {
  dispose(): void;
}

export function isDisposable<E extends object>(thing: E): thing is E & IDisposable {
  return typeof (<IDisposable><any>thing).dispose === 'function'
    && (<IDisposable><any>thing).dispose.length === 0;
}

export function dispose<T extends IDisposable>(disposable: T): T;
export function dispose<T extends IDisposable>(...disposables: Array<T | undefined>): T[];
export function dispose<T extends IDisposable>(disposables: T[]): T[];
export function dispose<T extends IDisposable>(first: T | T[], ...rest: T[]): T | T[] | undefined {
  if (Array.isArray(first)) {
		first.forEach(d => {
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
  const self = trackDisposable({
		dispose: () => {
			markTracked(self);
			fn();
		}
	});
	return self;
}

export abstract class Disposable implements IDisposable {

  static None = Object.freeze<IDisposable>({ dispose() { } });

  protected _toDispose: IDisposable[] = [];
  protected get toDispose(): IDisposable[] { return this._toDispose; }
  // tslint:disable-next-line
  private _lifecycle_disposable_isDisposed = false;

  public dispose(): void {
    this._lifecycle_disposable_isDisposed = true;
    this._toDispose = dispose(this._toDispose);
  }

  protected _register<T extends IDisposable>(t: T): T {
    if (this._lifecycle_disposable_isDisposed) {
      console.warn('Registering disposable on object that has already been disposed.');
      t.dispose();
    } else {
      this._toDispose.push(t);
    }

    return t;
  }
}

export interface IReference<T> extends IDisposable {
  readonly object: T;
}

export abstract class ReferenceCollection<T> {

  private references: { [key: string]: { readonly object: T; counter: number; } } = Object.create(null);

  constructor() { }

  acquire(key: string): IReference<T> {
    let reference = this.references[key];

    if (!reference) {
      reference = this.references[key] = { counter: 0, object: this.createReferencedObject(key) };
    }

    const { object } = reference;
    const dispose = once(() => {
      if (--reference.counter === 0) {
        this.destroyReferencedObject(key, reference.object);
        delete this.references[key];
      }
    });

    reference.counter++;

    return { object, dispose };
  }

  protected abstract createReferencedObject(key: string): T;
  protected abstract destroyReferencedObject(key: string, object: T): void;
}

export class ImmortalReference<T> implements IReference<T> {
  constructor(public object: T) { }
  dispose(): void { /* noop */ }
}
