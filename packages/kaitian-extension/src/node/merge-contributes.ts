/**
 * handle `kaitianContributes` and `contributes`
 */
import mergeWith = require('lodash/mergeWith');
import { asArray } from '@ali/ide-core-common';

import { IExtensionContributions } from '../common/vscode/extension';
import { IKaitianExtensionContributions } from '../common/kaitian/extension';

export function mergeContributes(
  contributes: IExtensionContributions | undefined,
  kaitianContributes: IKaitianExtensionContributions | undefined,
): IKaitianExtensionContributions {
  if (contributes === undefined) {
    return kaitianContributes || {};
  }

  if (kaitianContributes === undefined) {
    return contributes || {};
  }

  return mergeWith(kaitianContributes, contributes, (value, srcValue, key, object, source) => {
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
