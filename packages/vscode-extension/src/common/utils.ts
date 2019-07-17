import * as vscode from 'vscode';
import * as types from './ext-types';

/**
 * Returns `true` if the parameter has type "object" and not null, an array, a regexp, a date.
 */
// tslint:disable-next-line:no-any
export function isObject(obj: any): boolean {
  return typeof obj === 'object'
      && obj !== null
      && !Array.isArray(obj)
      && !(obj instanceof RegExp)
      && !(obj instanceof Date);
}

// tslint:disable-next-line:no-any
export function mixin(destination: any, source: any, overwrite: boolean = true): any {
  if (!isObject(destination)) {
      return source;
  }

  if (isObject(source)) {
      Object.keys(source).forEach((key) => {
          if (key in destination) {
              if (overwrite) {
                  if (isObject(destination[key]) && isObject(source[key])) {
                      mixin(destination[key], source[key], overwrite);
                  } else {
                      destination[key] = source[key];
                  }
              }
          } else {
              destination[key] = source[key];
          }
      });
  }
  return destination;
}

export function illegalArgument(message?: string): Error {
    if (message) {
        return new Error(`Illegal argument: ${message}`);
    } else {
        return new Error('Illegal argument');
    }
}

/* tslint:disable-next-line:no-any */
export function isLocationArray(array: any): array is types.Location[] {
    return Array.isArray(array) && array.length > 0 && array[0] instanceof types.Location;
}

/* tslint:disable-next-line:no-any */
export function isDefinitionLinkArray(array: any): array is vscode.DefinitionLink[] {
    return Array.isArray(array) && array.length > 0 && array[0].hasOwnProperty('targetUri') && array[0].hasOwnProperty('targetRange');
}
