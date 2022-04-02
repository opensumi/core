/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/arrays.ts

import { IDisposable } from './disposable';
import { ISplice } from './sequence';

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
export function enumValueToArray<T>(enumeration: T): NonFunctional<T[keyof T]>[] {
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
