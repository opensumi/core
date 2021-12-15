// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/async.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arrays from '../../src/utils/arrays';

function deepStrictEqual(a, b) {
  expect(a).toEqual(b);
}

function strictEqual(a, b) {
  expect(a).toBe(b);
}

describe('Arrays', () => {
  test('sortedDiff', () => {
    function compare(a: number, b: number): number {
      return a - b;
    }

    let d = arrays.sortedDiff([1, 2, 4], [], compare);
    deepStrictEqual(d, [{ start: 0, deleteCount: 3, toInsert: [] }]);

    d = arrays.sortedDiff([], [1, 2, 4], compare);
    deepStrictEqual(d, [{ start: 0, deleteCount: 0, toInsert: [1, 2, 4] }]);

    d = arrays.sortedDiff([1, 2, 4], [1, 2, 4], compare);
    deepStrictEqual(d, []);

    d = arrays.sortedDiff([1, 2, 4], [2, 3, 4, 5], compare);
    deepStrictEqual(d, [
      { start: 0, deleteCount: 1, toInsert: [] },
      { start: 2, deleteCount: 0, toInsert: [3] },
      { start: 3, deleteCount: 0, toInsert: [5] },
    ]);

    d = arrays.sortedDiff([2, 3, 4, 5], [1, 2, 4], compare);
    deepStrictEqual(d, [
      { start: 0, deleteCount: 0, toInsert: [1] },
      { start: 1, deleteCount: 1, toInsert: [] },
      { start: 3, deleteCount: 1, toInsert: [] },
    ]);

    d = arrays.sortedDiff([1, 3, 5, 7], [5, 9, 11], compare);
    deepStrictEqual(d, [
      { start: 0, deleteCount: 2, toInsert: [] },
      { start: 3, deleteCount: 1, toInsert: [9, 11] },
    ]);

    d = arrays.sortedDiff([1, 3, 7], [5, 9, 11], compare);
    deepStrictEqual(d, [{ start: 0, deleteCount: 3, toInsert: [5, 9, 11] }]);
  });

  test('distinct', () => {
    function compare(a: string): string {
      return a;
    }

    deepStrictEqual(arrays.distinct(['32', '4', '5'], compare), ['32', '4', '5']);
    deepStrictEqual(arrays.distinct(['32', '4', '5', '4'], compare), ['32', '4', '5']);
    deepStrictEqual(arrays.distinct(['32', 'constructor', '5', '1'], compare), ['32', 'constructor', '5', '1']);
    deepStrictEqual(arrays.distinct(['32', 'constructor', 'proto', 'proto', 'constructor'], compare), [
      '32',
      'constructor',
      'proto',
    ]);
    deepStrictEqual(arrays.distinct(['32', '4', '5', '32', '4', '5', '32', '4', '5', '5'], compare), ['32', '4', '5']);
  });

  test('coalesce', () => {
    const a: Array<number | null> = arrays.coalesce([null, 1, null, 2, 3]);
    strictEqual(a.length, 3);
    strictEqual(a[0], 1);
    strictEqual(a[1], 2);
    strictEqual(a[2], 3);

    arrays.coalesce([null, 1, null, undefined, undefined, 2, 3]);
    strictEqual(a.length, 3);
    strictEqual(a[0], 1);
    strictEqual(a[1], 2);
    strictEqual(a[2], 3);

    let b: number[] = [];
    b[10] = 1;
    b[20] = 2;
    b[30] = 3;
    b = arrays.coalesce(b);
    strictEqual(b.length, 3);
    strictEqual(b[0], 1);
    strictEqual(b[1], 2);
    strictEqual(b[2], 3);

    let sparse: number[] = [];
    sparse[0] = 1;
    sparse[1] = 1;
    sparse[17] = 1;
    sparse[1000] = 1;
    sparse[1001] = 1;

    strictEqual(sparse.length, 1002);

    sparse = arrays.coalesce(sparse);
    strictEqual(sparse.length, 5);
  });
});
