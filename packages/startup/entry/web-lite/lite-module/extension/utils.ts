import { mergeWith } from 'lodash';

import { Uri, asArray } from '@opensumi/ide-core-common';
import { IExtensionMetaData } from '@opensumi/ide-extension/lib/common';
import { ISumiExtensionContributions } from '@opensumi/ide-extension/lib/common/sumi/extension';
import { IExtensionContributions } from '@opensumi/ide-extension/lib/common/vscode/extension';

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
      // TODO: 是否需要去重
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

export async function getExtension(extensionId: string, version: string): Promise<IExtensionMetaData | undefined> {
  const extPath = `gw.alipayobjects.com/os/marketplace/assets/${extensionId}/v${version}/extension/`;
  const packageJSON = await fetch(`https://${extPath}package.json`).then((res) => res.json());
  // merge for `kaitianContributes` and `contributes`
  packageJSON.contributes = mergeContributes(packageJSON.kaitianContributes, packageJSON.contributes);

  const extensionPath = 'ext://' + extPath;
  const extension = {
    // vscode 规范
    id: `${packageJSON.publisher}.${packageJSON.name}`,
    // 使用插件市场的 id
    // 从插件市场下载的插件命名规范为 ${publisher}.${name}-${version}
    extensionId,
    extendConfig: {},
    path: extensionPath,
    packageJSON,
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    realPath: extensionPath,
    uri: Uri.parse(extensionPath),
  };
  return extension as IExtensionMetaData;
}
