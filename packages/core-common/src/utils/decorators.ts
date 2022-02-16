/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/decorators.ts

export function createDecorator(mapFn: (fn: Function, key: string) => Function): Function {
  return (target: any, key: string, descriptor: any) => {
    let fnKey: string | null = null;
    let fn: Function | null = null;

    if (typeof descriptor.value === 'function') {
      fnKey = 'value';
      fn = descriptor.value;
    } else if (typeof descriptor.get === 'function') {
      fnKey = 'get';
      fn = descriptor.get;
    }

    if (!fn) {
      throw new Error('not supported');
    }

    descriptor[fnKey!] = mapFn(fn, key);
  };
}

let memoizeId = 0;
export function createMemoizer() {
  const memoizeKeyPrefix = `$memoize${memoizeId++}`;
  let self: any;

  const result = function memoize(target: any, key: string, descriptor: any) {
    let fnKey: string | null = null;
    let fn: Function | null = null;

    if (typeof descriptor.value === 'function') {
      fnKey = 'value';
      fn = descriptor.value;

      if (fn!.length !== 0) {
        // eslint-disable-next-line no-console
        console.warn('Memoize should only be used in functions with zero parameters');
      }
    } else if (typeof descriptor.get === 'function') {
      fnKey = 'get';
      fn = descriptor.get;
    }

    if (!fn) {
      throw new Error('not supported');
    }

    const memoizeKey = `${memoizeKeyPrefix}:${key}`;
    descriptor[fnKey!] = function (...args: any[]) {
      self = this;

      if (!this.hasOwnProperty(memoizeKey)) {
        Object.defineProperty(this, memoizeKey, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: fn!.apply(this, args),
        });
      }

      return this[memoizeKey];
    };
  };

  result.clear = () => {
    if (typeof self === 'undefined') {
      return;
    }
    Object.getOwnPropertyNames(self).forEach((property) => {
      if (property.indexOf(memoizeKeyPrefix) === 0) {
        delete self[property];
      }
    });
  };

  return result;
}

export function memoize(target: any, key: string, descriptor: any) {
  return createMemoizer()(target, key, descriptor);
}

export type IDebounceReducer<T> = (previousValue: T, ...args: any[]) => T;

export function debounce<T>(delay: number, reducer?: IDebounceReducer<T>, initialValueProvider?: () => T): Function {
  return createDecorator((fn, key) => {
    const timerKey = `$debounce$${key}`;
    const resultKey = `$debounce$result$${key}`;

    return function (this: any, ...args: any[]) {
      if (!this[resultKey]) {
        this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
      }

      clearTimeout(this[timerKey]);

      if (reducer) {
        this[resultKey] = reducer(this[resultKey], ...args);
        args = [this[resultKey]];
      }

      this[timerKey] = setTimeout(() => {
        fn.apply(this, args);
        this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
      }, delay);
    };
  });
}

export function throttle<T>(delay: number, reducer?: IDebounceReducer<T>, initialValueProvider?: () => T): Function {
  return createDecorator((fn, key) => {
    const timerKey = `$throttle$timer$${key}`;
    const resultKey = `$throttle$result$${key}`;
    const lastRunKey = `$throttle$lastRun$${key}`;
    const pendingKey = `$throttle$pending$${key}`;

    return function (this: any, ...args: any[]) {
      if (!this[resultKey]) {
        this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
      }
      if (this[lastRunKey] === null || this[lastRunKey] === undefined) {
        this[lastRunKey] = -Number.MAX_VALUE;
      }

      if (reducer) {
        this[resultKey] = reducer(this[resultKey], ...args);
      }

      if (this[pendingKey]) {
        return;
      }

      const nextTime = this[lastRunKey] + delay;
      if (nextTime <= Date.now()) {
        this[lastRunKey] = Date.now();
        fn.apply(this, [this[resultKey]]);
        this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
      } else {
        this[pendingKey] = true;
        this[timerKey] = setTimeout(() => {
          this[pendingKey] = false;
          this[lastRunKey] = Date.now();
          fn.apply(this, [this[resultKey]]);
          this[resultKey] = initialValueProvider ? initialValueProvider() : undefined;
        }, nextTime - Date.now());
      }
    };
  });
}

export function es5ClassCompat(target: any): any {
  function _() {
    // @ts-ignore
    return Reflect.construct(target, arguments, this.constructor);
  }
  Object.defineProperty(_, 'name', Object.getOwnPropertyDescriptor(target, 'name')!);
  Object.setPrototypeOf(_, target);
  Object.setPrototypeOf(_.prototype, target.prototype);
  return _;
}
