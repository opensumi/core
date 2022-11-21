/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/arrays.ts

import { IDisposable } from './disposable';
import { ISplice } from './sequence';

export function asStringArray(array: unknown, defaultValue: string[]): string[] {
  if (!Array.isArray(array)) {
    return defaultValue;
  }
  if (!array.every((e) => typeof e === 'string')) {
    return defaultValue;
  }
  return array;
}

export function isNonEmptyArray<T>(obj: ReadonlyArray<T> | undefined | null): obj is Array<T> {
  return Array.isArray(obj) && obj.length > 0;
}
/**
 * 移除给定数组中的重复值
 * keyFn函数支持指定校验逻辑
 */
export function distinct<T>(array: ReadonlyArray<T>, keyFn?: (t: T) => string): T[] {
  if (!keyFn) {
    return array.filter((element, position) => array.indexOf(element) === position);
  }

  const seen: { [key: string]: boolean } = Object.create(null);
  return array.filter((elem) => {
    const key = keyFn(elem);
    if (seen[key]) {
      return false;
    }

    seen[key] = true;

    return true;
  });
}

interface IMutableSplice<T> extends ISplice<T> {
  deleteCount: number;
}

/**
 * Diffs two *sorted* arrays and computes the splices which apply the diff.
 */
export function sortedDiff<T>(
  before: ReadonlyArray<T>,
  after: ReadonlyArray<T>,
  compare: (a: T, b: T) => number,
): ISplice<T>[] {
  const result: IMutableSplice<T>[] = [];

  function pushSplice(start: number, deleteCount: number, toInsert: T[]): void {
    if (deleteCount === 0 && toInsert.length === 0) {
      return;
    }

    const latest = result[result.length - 1];

    if (latest && latest.start + latest.deleteCount === start) {
      latest.deleteCount += deleteCount;
      latest.toInsert.push(...toInsert);
    } else {
      result.push({ start, deleteCount, toInsert });
    }
  }

  let beforeIdx = 0;
  let afterIdx = 0;

  while (true) {
    if (beforeIdx === before.length) {
      pushSplice(beforeIdx, 0, after.slice(afterIdx));
      break;
    }
    if (afterIdx === after.length) {
      pushSplice(beforeIdx, before.length - beforeIdx, []);
      break;
    }

    const beforeElement = before[beforeIdx];
    const afterElement = after[afterIdx];
    const n = compare(beforeElement, afterElement);
    if (n === 0) {
      // equal
      beforeIdx += 1;
      afterIdx += 1;
    } else if (n < 0) {
      // beforeElement is smaller -> before element removed
      pushSplice(beforeIdx, 1, []);
      beforeIdx += 1;
    } else if (n > 0) {
      // beforeElement is greater -> after element added
      pushSplice(beforeIdx, 0, [afterElement]);
      afterIdx += 1;
    }
  }

  return result;
}

export function equals<T>(
  one: ReadonlyArray<T> | undefined,
  other: ReadonlyArray<T> | undefined,
  itemEquals: (a: T, b: T) => boolean = (a, b) => a === b,
): boolean {
  if (one === other) {
    return true;
  }

  if (!one || !other) {
    return false;
  }

  if (one.length !== other.length) {
    return false;
  }

  for (let i = 0, len = one.length; i < len; i++) {
    if (!itemEquals(one[i], other[i])) {
      return false;
    }
  }

  return true;
}

export function asArray<T>(x: T | T[]): T[];
export function asArray<T>(x: T | readonly T[]): readonly T[];
export function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

/**
 * 获取非空数组
 * @param array
 */
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
  return array.filter((e) => !!e) as T[];
}

export function addElement<T>(array: Array<T>, element: T, unshift = false): IDisposable {
  if (unshift) {
    array.unshift(element);
  } else {
    array.push(element);
  }
  return {
    dispose: () => {
      const index = array.indexOf(element);
      if (index !== -1) {
        array.splice(index, 1);
      }
    },
  };
}

export function addMapElement<K, T>(map: Map<K, T>, key: K, element: T): IDisposable {
  map.set(key, element);
  return {
    dispose: () => {
      if (map.get(key) === element) {
        map.delete(key);
      }
    },
  };
}

type NonFunctional<T> = T extends Function ? never : T;

// 枚举 value 转数组值
export function enumValueToArray<T extends object>(enumeration: T): NonFunctional<T[keyof T]>[] {
  return Object.keys(enumeration)
    .filter((key) => isNaN(Number(key)))
    .map((key) => enumeration[key])
    .filter((val) => typeof val === 'number' || typeof val === 'string');
}

/**
 * @returns false if the provided object is an array and not empty.
 */
export function isFalsyOrEmpty(obj: any): boolean {
  return !Array.isArray(obj) || obj.length === 0;
}

export function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}

export function range(to: number): number[];
export function range(arg: number, to?: number): number[] {
  let from = typeof to === 'number' ? arg : 0;

  if (typeof to === 'number') {
    from = arg;
  } else {
    from = 0;
    to = arg;
  }

  const result: number[] = [];

  if (from <= to) {
    for (let i = from; i < to; i++) {
      result.push(i);
    }
  } else {
    for (let i = from; i > to; i--) {
      result.push(i);
    }
  }

  return result;
}

export function fill<T>(num: number, value: T, arr: T[] = []): T[] {
  for (let i = 0; i < num; i++) {
    arr[i] = value;
  }

  return arr;
}

/**
 * Takes a sorted array and a function p. The array is sorted in such a way that all elements where p(x) is false
 * are located before all elements where p(x) is true.
 * @returns the least x for which p(x) is true or array.length if no element fullfills the given function.
 */
export function findFirstInSorted<T>(array: ReadonlyArray<T>, p: (x: T) => boolean): number {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0; // no children
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (p(array[mid])) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

type Compare<T> = (a: T, b: T) => number;

function _merge<T>(a: T[], compare: Compare<T>, lo: number, mid: number, hi: number, aux: T[]): void {
  let leftIdx = lo;
  let rightIdx = mid + 1;
  for (let i = lo; i <= hi; i++) {
    aux[i] = a[i];
  }
  for (let i = lo; i <= hi; i++) {
    if (leftIdx > mid) {
      // left side consumed
      a[i] = aux[rightIdx++];
    } else if (rightIdx > hi) {
      // right side consumed
      a[i] = aux[leftIdx++];
    } else if (compare(aux[rightIdx], aux[leftIdx]) < 0) {
      // right element is less -> comes first
      a[i] = aux[rightIdx++];
    } else {
      // left element comes first (less or equal)
      a[i] = aux[leftIdx++];
    }
  }
}

function _sort<T>(a: T[], compare: Compare<T>, lo: number, hi: number, aux: T[]) {
  if (hi <= lo) {
    return;
  }
  const mid = (lo + (hi - lo) / 2) | 0;
  _sort(a, compare, lo, mid, aux);
  _sort(a, compare, mid + 1, hi, aux);
  if (compare(a[mid], a[mid + 1]) <= 0) {
    // left and right are sorted and if the last-left element is less
    // or equals than the first-right element there is nothing else
    // to do
    return;
  }
  _merge(a, compare, lo, mid, hi, aux);
}

/**
 * Like `Array#sort` but always stable. Usually runs a little slower `than Array#sort`
 * so only use this when actually needing stable sort.
 */
export function mergeSort<T>(data: T[], compare: Compare<T>): T[] {
  _sort(data, compare, 0, data.length - 1, []);
  return data;
}

/**
 * Returns the first mapped value of the array which is not undefined.
 */
export function mapFind<T, R>(array: Iterable<T>, mapFn: (value: T) => R | undefined): R | undefined {
  for (const value of array) {
    const mapped = mapFn(value);
    if (mapped !== undefined) {
      return mapped;
    }
  }

  return undefined;
}

export function groupBy<T>(data: ReadonlyArray<T>, compare: (a: T, b: T) => number): T[][] {
  const result: T[][] = [];
  let currentGroup: T[] | undefined;
  for (const element of data.slice(0).sort(compare)) {
    if (!currentGroup || compare(currentGroup[0], element) !== 0) {
      currentGroup = [element];
      result.push(currentGroup);
    } else {
      currentGroup.push(element);
    }
  }
  return result;
}
