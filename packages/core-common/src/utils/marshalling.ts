/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../uri';

import { regExpFlags } from './strings';

export function stringify(obj: any): string {
  return JSON.stringify(obj, replacer);
}

export function parse(text: string): any {
  let data = JSON.parse(text);
  data = revive(data, 0);
  return data;
}

export interface MarshalledObject {
  $mid: number;
}

function replacer(key: string, value: any): any {
  // URI is done via toJSON-member
  if (value instanceof RegExp) {
    return {
      $mid: 2,
      source: value.source,
      flags: regExpFlags(value),
    };
  }
  return value;
}

export function revive(obj: any, depth = 0): any {
  if (!obj || depth > 200) {
    return obj;
  }

  if (typeof obj === 'object') {
    switch ((obj as MarshalledObject).$mid) {
      case 1:
        return URI.revive(obj);
      case 2:
        return new RegExp(obj.source, obj.flags);
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; ++i) {
        obj[i] = revive(obj[i], depth + 1);
      }
    } else {
      // walk object
      for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
          obj[key] = revive(obj[key], depth + 1);
        }
      }
    }
  }

  return obj;
}
