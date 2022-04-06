/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from '../src/arrays';

function equal(a, b) {
  expect(a).toBe(b);
}

function deepEqual(a, b) {
  expect(a).toEqual(b);
}

function assertOk(value) {
  expect(value).toBeTruthy();
}

function assertFail(value) {
  expect(value).toThrowError();
}

describe('Arrays', () => {
  test('findFirst', () => {
    const array = [1, 4, 5, 7, 55, 59, 60, 61, 64, 69];

    let idx = arrays.findFirstInSorted(array, (e) => e >= 0);
    equal(array[idx], 1);

    idx = arrays.findFirstInSorted(array, (e) => e > 1);
    equal(array[idx], 4);

    idx = arrays.findFirstInSorted(array, (e) => e >= 8);
    equal(array[idx], 55);

    idx = arrays.findFirstInSorted(array, (e) => e >= 61);
    equal(array[idx], 61);

    idx = arrays.findFirstInSorted(array, (e) => e >= 69);
    equal(array[idx], 69);

    idx = arrays.findFirstInSorted(array, (e) => e >= 70);
    equal(idx, array.length);

    idx = arrays.findFirstInSorted([], (e) => e >= 0);
    equal(array[idx], 1);
  });

  test('stableSort', () => {
    function fill<T>(num: number, valueFn: () => T, arr: T[] = []): T[] {
      for (let i = 0; i < num; i++) {
        arr[i] = valueFn();
      }

      return arr;
    }

    let counter = 0;
    const data = fill(10000, () => ({ n: 1, m: counter++ }));

    arrays.mergeSort(data, (a, b) => a.n - b.n);

    let lastM = -1;
    for (const element of data) {
      assertOk(lastM < element.m);
      lastM = element.m;
    }
  });

  test('mergeSort', () => {
    const data = arrays.mergeSort([6, 5, 3, 1, 8, 7, 2, 4], (a, b) => a - b);
    deepEqual(data, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('mergeSort, sorted array', () => {
    const data = arrays.mergeSort([1, 2, 3, 4, 5, 6], (a, b) => a - b);
    deepEqual(data, [1, 2, 3, 4, 5, 6]);
  });

  test('mergeSort, is stable', () => {
    const numbers = arrays.mergeSort([33, 22, 11, 4, 99, 1], (a, b) => 0);
    deepEqual(numbers, [33, 22, 11, 4, 99, 1]);
  });

  test('mergeSort, many random numbers', () => {
    function compare(a: number, b: number) {
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      } else {
        return 0;
      }
    }

    function assertSorted(array: number[]) {
      const last = array[0];
      for (let i = 1; i < array.length; i++) {
        const n = array[i];
        if (last > n) {
          assertFail(JSON.stringify(array.slice(i - 10, i + 10)));
        }
      }
    }
    const MAX = 101;
    const data: number[][] = [];
    for (let i = 1; i < MAX; i++) {
      const array: number[] = [];
      for (let j = 0; j < 10 + i; j++) {
        array.push((Math.random() * 10e8) | 0);
      }
      data.push(array);
    }

    for (const array of data) {
      arrays.mergeSort(array, compare);
      assertSorted(array);
    }
  });

  test('sortedDiff', () => {
    function compare(a: number, b: number): number {
      return a - b;
    }

    let d = arrays.sortedDiff([1, 2, 4], [], compare);
    deepEqual(d, [{ start: 0, deleteCount: 3, toInsert: [] }]);

    d = arrays.sortedDiff([], [1, 2, 4], compare);
    deepEqual(d, [{ start: 0, deleteCount: 0, toInsert: [1, 2, 4] }]);

    d = arrays.sortedDiff([1, 2, 4], [1, 2, 4], compare);
    deepEqual(d, []);

    d = arrays.sortedDiff([1, 2, 4], [2, 3, 4, 5], compare);
    deepEqual(d, [
      { start: 0, deleteCount: 1, toInsert: [] },
      { start: 2, deleteCount: 0, toInsert: [3] },
      { start: 3, deleteCount: 0, toInsert: [5] },
    ]);

    d = arrays.sortedDiff([2, 3, 4, 5], [1, 2, 4], compare);
    deepEqual(d, [
      { start: 0, deleteCount: 0, toInsert: [1] },
      { start: 1, deleteCount: 1, toInsert: [] },
      { start: 3, deleteCount: 1, toInsert: [] },
    ]);

    d = arrays.sortedDiff([1, 3, 5, 7], [5, 9, 11], compare);
    deepEqual(d, [
      { start: 0, deleteCount: 2, toInsert: [] },
      { start: 3, deleteCount: 1, toInsert: [9, 11] },
    ]);

    d = arrays.sortedDiff([1, 3, 7], [5, 9, 11], compare);
    deepEqual(d, [{ start: 0, deleteCount: 3, toInsert: [5, 9, 11] }]);
  });

  test('distinct', () => {
    function compare(a: string): string {
      return a;
    }

    deepEqual(arrays.distinct(['32', '4', '5'], compare), ['32', '4', '5']);
    deepEqual(arrays.distinct(['32', '4', '5', '4'], compare), ['32', '4', '5']);
    deepEqual(arrays.distinct(['32', 'constructor', '5', '1'], compare), ['32', 'constructor', '5', '1']);
    deepEqual(arrays.distinct(['32', 'constructor', 'proto', 'proto', 'constructor'], compare), [
      '32',
      'constructor',
      'proto',
    ]);
    deepEqual(arrays.distinct(['32', '4', '5', '32', '4', '5', '32', '4', '5', '5'], compare), ['32', '4', '5']);
  });

  test('coalesce', () => {
    const a: Array<number | null> = arrays.coalesce([null, 1, null, 2, 3]);
    equal(a.length, 3);
    equal(a[0], 1);
    equal(a[1], 2);
    equal(a[2], 3);

    arrays.coalesce([null, 1, null, undefined, undefined, 2, 3]);
    equal(a.length, 3);
    equal(a[0], 1);
    equal(a[1], 2);
    equal(a[2], 3);

    let b: number[] = [];
    b[10] = 1;
    b[20] = 2;
    b[30] = 3;
    b = arrays.coalesce(b);
    equal(b.length, 3);
    equal(b[0], 1);
    equal(b[1], 2);
    equal(b[2], 3);

    let sparse: number[] = [];
    sparse[0] = 1;
    sparse[1] = 1;
    sparse[17] = 1;
    sparse[1000] = 1;
    sparse[1001] = 1;

    equal(sparse.length, 1002);

    sparse = arrays.coalesce(sparse);
    equal(sparse.length, 5);
  });
});
