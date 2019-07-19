import * as vscode from 'vscode';
import * as types from '../../common/ext-types';
import { Event } from '@ali/ide-core-common';

// tslint:disable-next-line:no-any
export function createToken(): any {
  return Object.freeze({
      isCancellationRequested: false,
      onCancellationRequested: Event.None,
  });
}

export interface ObjectIdentifier {
  $ident: number;
}

export namespace ObjectIdentifier {
  export const name = '$ident';

  export function mixin<T>(obj: T, id: number): T & ObjectIdentifier {
      Object.defineProperty(obj, name, { value: id, enumerable: true });
      return obj as T & ObjectIdentifier;
  }

  // tslint:disable-next-line:no-any
  export function of(obj: any): number {
      return obj[name];
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
