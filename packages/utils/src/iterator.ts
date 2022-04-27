/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IteratorDefinedResult<T> {
  readonly done: false;
  readonly value: T;
}
export interface IteratorUndefinedResult {
  readonly done: true;
  readonly value: undefined;
}
export const FIN: IteratorUndefinedResult = { done: true, value: undefined };
export type IteratorResult<T> = IteratorDefinedResult<T> | IteratorUndefinedResult;

export interface Iterator<T> {
  next(): IteratorResult<T>;
}

export function filter<T, R extends T>(iterable: Iterable<T>, predicate: (t: T) => t is R): Iterable<R>;
export function filter<T>(iterable: Iterable<T>, predicate: (t: T) => boolean): Iterable<T>;
export function* filter<T>(iterable: Iterable<T>, predicate: (t: T) => boolean): Iterable<T> {
  for (const element of iterable) {
    if (predicate(element)) {
      yield element;
    }
  }
}

export function* map<T, R>(iterable: Iterable<T>, fn: (t: T, index: number) => R): Iterable<R> {
  let index = 0;
  for (const element of iterable) {
    yield fn(element, index++);
  }
}
