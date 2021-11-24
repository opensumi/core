import { IExtensionMetaData } from '@opensumi/ide-extension/lib/common';
import { Uri } from '@opensumi/ide-core-common';

const ktMarketBase = 'kt-ext://alipay-rmsdeploy-image.cn-hangzhou.alipay.aliyun-inc.com/marketplace/assets';

export const nodeLessExtensions: IExtensionMetaData[] = [
  {
    id: 'def-ide-theme',
    isBuiltin: false,
    extensionId: 'tao.def-ide-theme',
    path: 'kt-ext://g.alicdn.com/tao-ide/ide-lite/0.0.1/extensions/theme/',
    uri: Uri.parse('kt-ext://g.alicdn.com/tao-ide/ide-lite/0.0.1/extensions/theme'),
    extraMetadata: {},
    realPath: 'kt-ext://g.alicdn.com/tao-ide/ide-lite/0.0.1/extensions/theme',
    extendConfig: {},
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    packageJSON: {
      'contributes': {
        'themes': [
          {
            'id': 'tao-ide-dark',
            'label': 'Tao IDE Dark',
            'uiTheme': 'vs-dark',
            'path': './dark/plus.json',
          },
          {
            'id': 'tao-ide-light',
            'label': 'Tao IDE Light',
            'uiTheme': 'vs',
            'path': './light/plus.json',
          },
        ],
      },
    },
  },
  {
    id: 'vsicons-slim',
    extensionId: 'kaitian.vsicons-slim',
    isBuiltin: true,
    path: ktMarketBase + '/kaitian.vsicons-slim/v1.0.4/extension/',
    uri: Uri.parse(ktMarketBase + '/kaitian.vsicons-slim/v1.0.4/extension/'),
    extraMetadata: {},
    realPath: ktMarketBase + '/kaitian.vsicons-slim/v1.0.4/extension/',
    extendConfig: {},
    defaultPkgNlsJSON: undefined,
    packageNlsJSON: undefined,
    packageJSON: {
      'contributes': {
        'iconThemes': [
          {
            'id': 'vsicons-slim',
            'label': 'VSCode Icons Slim',
            'path': 'vsicons-slim.json',
          },
        ],
      },
    },
  },
];
