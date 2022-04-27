// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/decorators.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { memoize, throttle } from '../src/decorators';

describe('Decorators', () => {
  test('memoize should memoize methods', () => {
    class Foo {
      count = 0;

      constructor(private _answer: number | null | undefined) {}

      @memoize
      answer() {
        this.count++;
        return this._answer;
      }
    }

    const foo = new Foo(42);
    expect(foo.count).toEqual(0);
    expect(foo.answer()).toEqual(42);
    expect(foo.count).toEqual(1);
    expect(foo.answer()).toEqual(42);
    expect(foo.count).toEqual(1);

    const foo2 = new Foo(1337);
    expect(foo2.count).toEqual(0);
    expect(foo2.answer()).toEqual(1337);
    expect(foo2.count).toEqual(1);
    expect(foo2.answer()).toEqual(1337);
    expect(foo2.count).toEqual(1);

    expect(foo.answer()).toEqual(42);
    expect(foo.count).toEqual(1);

    const foo3 = new Foo(null);
    expect(foo3.count).toEqual(0);
    expect(foo3.answer()).toEqual(null);
    expect(foo3.count).toEqual(1);
    expect(foo3.answer()).toEqual(null);
    expect(foo3.count).toEqual(1);

    const foo4 = new Foo(undefined);
    expect(foo4.count).toEqual(0);
    expect(foo4.answer()).toEqual(undefined);
    expect(foo4.count).toEqual(1);
    expect(foo4.answer()).toEqual(undefined);
    expect(foo4.count).toEqual(1);
  });

  test('memoize should memoize getters', () => {
    class Foo {
      count = 0;

      constructor(private _answer: number | null | undefined) {}

      @memoize
      get answer() {
        this.count++;
        return this._answer;
      }
    }

    const foo = new Foo(42);
    expect(foo.count).toEqual(0);
    expect(foo.answer).toEqual(42);
    expect(foo.count).toEqual(1);
    expect(foo.answer).toEqual(42);
    expect(foo.count).toEqual(1);

    const foo2 = new Foo(1337);
    expect(foo2.count).toEqual(0);
    expect(foo2.answer).toEqual(1337);
    expect(foo2.count).toEqual(1);
    expect(foo2.answer).toEqual(1337);
    expect(foo2.count).toEqual(1);

    expect(foo.answer).toEqual(42);
    expect(foo.count).toEqual(1);

    const foo3 = new Foo(null);
    expect(foo3.count).toEqual(0);
    expect(foo3.answer).toEqual(null);
    expect(foo3.count).toEqual(1);
    expect(foo3.answer).toEqual(null);
    expect(foo3.count).toEqual(1);

    const foo4 = new Foo(undefined);
    expect(foo4.count).toEqual(0);
    expect(foo4.answer).toEqual(undefined);
    expect(foo4.count).toEqual(1);
    expect(foo4.answer).toEqual(undefined);
    expect(foo4.count).toEqual(1);
  });

  test('memoized property should not be enumerable', () => {
    class Foo {
      @memoize
      get answer() {
        return 42;
      }
    }

    const foo = new Foo();
    expect(foo.answer).toEqual(42);

    expect(!Object.keys(foo).some((k) => /\$memoize\$/.test(k))).toBeTruthy();
  });

  test('memoized property should not be writable', () => {
    class Foo {
      @memoize
      get answer() {
        return 42;
      }
    }

    const foo = new Foo();
    expect(foo.answer).toEqual(42);

    try {
      (foo as any)['$memoize$answer'] = 1337;
      expect(false).toBeTruthy();
    } catch (e) {
      expect(foo.answer).toEqual(42);
    }
  });

  test('throttle', () => {
    const spy = jest.fn();
    jest.useFakeTimers();
    try {
      class ThrottleTest {
        private _handle: Function;

        constructor(fn: Function) {
          this._handle = fn;
        }

        @throttle(100, (a: number, b: number) => a + b, () => 0)
        report(p: number): void {
          this._handle(p);
        }
      }

      const t = new ThrottleTest(spy);

      t.report(1);
      t.report(2);
      t.report(3);
      expect(spy).toBeCalledWith(1);
      spy.mockClear();
      jest.advanceTimersByTime(200);
      expect(spy).toBeCalledWith(5);
      spy.mockClear();

      t.report(4);
      t.report(5);
      jest.advanceTimersByTime(50);
      t.report(6);

      spy.mockClear();
      jest.advanceTimersByTime(60);
      expect(spy).toBeCalledWith(11);
    } finally {
      jest.useRealTimers();
    }
  });
});
