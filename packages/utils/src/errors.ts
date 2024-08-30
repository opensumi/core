/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.44.0/src/vs/base/common/errors.ts

import { isDefined } from './types';

export type ErrorListenerCallback = (error: any) => void;

export type ErrorListenerUnbind = () => void;

// Avoid circular dependency on EventEmitter by implementing a subset of the interface.
export class ErrorHandler {
  private unexpectedErrorHandler: (e: any) => void;
  private listeners: ErrorListenerCallback[];

  constructor() {
    this.listeners = [];

    this.unexpectedErrorHandler = function (e: any) {
      setTimeout(() => {
        if (e.stack) {
          throw new Error(e.message + '\n\n' + e.stack);
        }

        throw e;
      }, 0);
    };
  }

  public addListener(listener: ErrorListenerCallback): ErrorListenerUnbind {
    this.listeners.push(listener);

    return () => {
      this._removeListener(listener);
    };
  }

  private emit(e: any): void {
    this.listeners.forEach((listener) => {
      listener(e);
    });
  }

  private _removeListener(listener: ErrorListenerCallback): void {
    this.listeners.splice(this.listeners.indexOf(listener), 1);
  }

  public setUnexpectedErrorHandler(newUnexpectedErrorHandler: (e: any) => void): void {
    this.unexpectedErrorHandler = newUnexpectedErrorHandler;
  }

  public getUnexpectedErrorHandler(): (e: any) => void {
    return this.unexpectedErrorHandler;
  }

  public onUnexpectedError(e: any): void {
    this.unexpectedErrorHandler(e);
    this.emit(e);
  }

  // For external errors, we don't want the listeners to be called
  public onUnexpectedExternalError(e: any): void {
    this.unexpectedErrorHandler(e);
  }
}

export const errorHandler = new ErrorHandler();

export function setUnexpectedErrorHandler(newUnexpectedErrorHandler: (e: any) => void): void {
  errorHandler.setUnexpectedErrorHandler(newUnexpectedErrorHandler);
}

export function onUnexpectedError(e: any): undefined {
  // ignore errors from cancelled promises
  if (!isPromiseCanceledError(e)) {
    errorHandler.onUnexpectedError(e);
  }
  return undefined;
}

export function onUnexpectedExternalError(e: any): undefined {
  // ignore errors from cancelled promises
  if (!isPromiseCanceledError(e)) {
    errorHandler.onUnexpectedExternalError(e);
  }
  return undefined;
}

export interface SerializedError {
  readonly $isError: true;
  readonly name: string;
  readonly message: string;
  readonly stack: string;
}

const canceledName = 'Canceled';

/**
 * Checks if the given error is a promise in canceled state
 */
export function isPromiseCanceledError(error: any): boolean {
  return error instanceof Error && error.name === canceledName && error.message === canceledName;
}

/**
 * Returns an error that signals cancellation.
 */
export function canceled(): Error {
  const error = new Error(canceledName);
  error.name = error.message;
  return error;
}

export function illegalArgument(name?: string): Error {
  if (name) {
    return new Error(`Illegal argument: ${name}`);
  } else {
    return new Error('Illegal argument');
  }
}

export function illegalState(name?: string): Error {
  if (name) {
    return new Error(`Illegal state: ${name}`);
  } else {
    return new Error('Illegal state');
  }
}

export function readonly(name?: string): Error {
  return name
    ? new Error(`readonly property '${name} cannot be changed'`)
    : new Error('readonly property cannot be changed');
}

export function disposed(what: string): Error {
  const result = new Error(`${what} has been disposed`);
  result.name = 'DISPOSED';
  return result;
}

export function getErrorMessage(err: any): string {
  if (!err) {
    return 'Error';
  }

  if (err.message) {
    return err.message;
  }

  if (err.stack) {
    return err.stack.split('\n')[0];
  }

  return String(err);
}

export interface SerializedError {
  readonly $isError: true;
  readonly name: string;
  readonly message: string;
  readonly stack: string;
  readonly cause?: SerializedError;
}

export function transformErrorForSerialization(error: Error): SerializedError;
export function transformErrorForSerialization(error: any): any;
export function transformErrorForSerialization(error: any): any {
  if (error instanceof Error) {
    const { name, message, cause } = error;
    const stack: string = (error as any).stacktrace || (error as any).stack;
    return {
      $isError: true,
      name,
      message,
      stack,
      cause,
    };
  }

  // return as is
  return error;
}

function serializeErrorReplacer(key: string, value: any) {
  if (value instanceof Error) {
    return transformErrorForSerialization(value);
  }
  return value;
}

export function errorReviver(key: string, value: any): Error {
  if (isDefined(value) && value.$isError) {
    const result = new Error(value.message);
    result.name = value.name;
    result.stack = value.stack;
    result.cause = value.cause;

    return result;
  }

  return value;
}

export function stringifyError(error: any): string {
  return JSON.stringify(error, serializeErrorReplacer);
}

export function parseError(value: string): any {
  return JSON.parse(value, errorReviver);
}

export class AbortError extends Error {
  static is(e: any): boolean {
    return e instanceof Error && e.name === 'AbortError';
  }

  constructor() {
    super('');
    super.name = 'AbortError';
  }
}
