/**
 * handle `kaitianContributes` and `contributes`
 */
import mergeWith = require('lodash/mergeWith');

import { asArray } from '@opensumi/ide-core-common';

import { ISumiExtensionContributions } from '../common/sumi/extension';
import { IExtensionContributions } from '../common/vscode/extension';

export function mergeContributes(
  contributes: IExtensionContributions | undefined,
  sumiContributes: ISumiExtensionContributions | undefined,
): ISumiExtensionContributions {
  if (contributes === undefined) {
    return sumiContributes || {};
  }

  if (sumiContributes === undefined) {
    return contributes || {};
  }

  return mergeWith(sumiContributes, contributes, (value, srcValue, key, object, source) => {
    if (value === undefined || srcValue === undefined) {
      return value || srcValue;
    }

    if (['menus', 'viewsContainers', 'views'].includes(key)) {
      const childKeySet = new Set(Object.keys(value).concat(Object.keys(srcValue)));
      const result = {};
      // 合并掉相同 menuId 下的 menu items
      for (const childKey of childKeySet) {
        result[childKey] = (value[childKey] || []).concat(srcValue[childKey] || []);
      }
      return result;
    }

    if (key === 'configuration') {
      value = asArray(value);
      srcValue = asArray(srcValue);
    }

    if (Array.isArray(value) && Array.isArray(srcValue)) {
      return value.concat(srcValue);
    }
  });
}
