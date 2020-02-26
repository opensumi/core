import * as path from 'path';
import { IExtensionProps, IExtension } from '../../lib/common';

export const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, 'extension'),
  realPath: '/home/.kaitian/extensions/test.kaitian-extension-1.0.0',
  extensionId: 'uuid-for-test-extension',
  isUseEnable: true,
  enableProposedApi: false,
  isBuiltin: false,
  packageJSON: {
    name: 'kaitian-extension',
    main: './index.js',
  },
  extendConfig: {
    node: {
      main: './node.js',
    },
  },
  extraMetadata: {},
  packageNlsJSON: {},
  deafaultPkgNlsJSON: {},
};

export const mockExtensions: IExtension[] = [{
  ...mockExtensionProps,
  activate: () => {
    return true;
  },
  toJSON: () => mockExtensionProps,
}];
