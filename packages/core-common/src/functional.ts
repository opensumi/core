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

export function makeRandomHexString(length: number): string {
  const chars = ['0', '1', '2', '3', '4', '5', '6', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(chars.length * Math.random());
    result += chars[idx];
  }
  return result;
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
