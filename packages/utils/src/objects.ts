/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/objects.ts

import { isUndefinedOrNull, isArray, isObject } from './types';

const _hasOwnProperty = Object.prototype.hasOwnProperty;

export function deepFreeze<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  const stack: any[] = [obj];
  while (stack.length > 0) {
    const objectToFreeze = stack.shift();
    Object.freeze(objectToFreeze);
    for (const key in objectToFreeze) {
      if (_hasOwnProperty.call(objectToFreeze, key)) {
        const prop = objectToFreeze[key];
        if (typeof prop === 'object' && !Object.isFrozen(prop)) {
          stack.push(prop);
        }
      }
    }
  }
  return obj;
}

export function cloneAndChange(obj: any, changer: (orig: any) => any): any {
  return _cloneAndChange(obj, changer, new Set());
}

function _cloneAndChange(obj: any, changer: (orig: any) => any, seen: Set<any>): any {
  if (isUndefinedOrNull(obj)) {
    return obj;
  }

  const changed = changer(obj);
  if (typeof changed !== 'undefined') {
    return changed;
  }

  if (isArray(obj)) {
    const r1: any[] = [];
    for (const e of obj) {
      r1.push(_cloneAndChange(e, changer, seen));
    }
    return r1;
  }

  if (isObject(obj)) {
    if (seen.has(obj)) {
      throw new Error('Cannot clone recursive data-structure');
    }
    seen.add(obj);
    const r2 = {};
    for (const i2 in obj) {
      if (_hasOwnProperty.call(obj, i2)) {
        (r2 as any)[i2] = _cloneAndChange(obj[i2], changer, seen);
      }
    }
    seen.delete(obj);
    return r2;
  }

  return obj;
}

export function deepClone<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof RegExp) {
    return obj;
  }
  const result: any = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach((key: string) => {
    const prop = (obj as any)[key];
    if (prop && typeof prop === 'object') {
      result[key] = deepClone(prop);
    } else {
      result[key] = prop;
    }
  });
  return result;
}

export function isPlainObject(obj: object) {
  return typeof obj === 'object' && obj.constructor === Object;
}

export function removeUndefined<T extends object = any>(obj: T): T {
  if (!isPlainObject(obj)) {
    return obj;
  }
  const keys = Object.keys(obj);
  keys.forEach((key) => {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  });
  return obj;
}

export function cloneAndChangeByKV(obj: any, changer: (key: string, orig: any) => any): any {
  return _cloneAndChangeByKV(obj, changer, new Set());
}

function _cloneAndChangeByKV(obj: any, changer: (key: string, orig: any) => any, seen: Set<any>): any {
  if (isUndefinedOrNull(obj)) {
    return obj;
  }

  if (isArray(obj)) {
    const r1: any[] = [];
    for (const e of obj) {
      r1.push(_cloneAndChangeByKV(e, changer, seen));
    }
    return r1;
  }

  if (isObject(obj)) {
    if (seen.has(obj)) {
      throw new Error('Cannot clone recursive data-structure');
    }
    seen.add(obj);
    const r2 = {};
    for (const i2 in obj) {
      if (_hasOwnProperty.call(obj, i2)) {
        const changed = changer(i2, obj[i2]);
        if (typeof changed !== 'undefined') {
          (r2 as any)[i2] = changed;
        } else {
          (r2 as any)[i2] = _cloneAndChangeByKV(obj[i2], changer, seen);
        }
      }
    }
    seen.delete(obj);
    return r2;
  }

  return obj;
}
