/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function once<T extends Function>(this: any, fn: T): T {
  const _this = this;
  let didCall = false;
  let result: any;

  return function () {
    if (didCall) {
      return result;
    }

    didCall = true;
    result = fn.apply(_this, arguments);

    return result;
  } as any as T;
}

export function removeObjectFromArray<T = any>(array: Array<T>, object: T, comparator?: (o1: T, o2: T) => boolean) {
  let index = -1;
  if (comparator) {
    index = array.findIndex((o) => comparator(o, object));
  } else {
    index = array.indexOf(object);
  }
  if (index !== -1) {
    array.splice(index, 1);
  }
}

export function diffSets<T>(before: Set<T>, after: Set<T>): { removed: T[]; added: T[] } {
  const removed: T[] = [];
  const added: T[] = [];
  for (const element of before) {
    if (!after.has(element)) {
      removed.push(element);
    }
  }
  for (const element of after) {
    if (!before.has(element)) {
      added.push(element);
    }
  }
  return { removed, added };
}

export function findFirstTruthy<T>(...sources: Array<T | (() => T)>): T | undefined {
  for (let i = 0; i <= sources.length - 1; i++) {
    const result = check(sources[i]);
    if (result) {
      return result;
    }
  }

  return undefined;

  function check(value: T | (() => T)): T | undefined {
    if (typeof value === 'function') {
      return (value as () => T)();
    }
    return value;
  }
}
