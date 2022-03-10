import path from 'path';

import { Uri } from '@opensumi/ide-core-common';

import { IExtension, IExtensionProps } from '../src/common';
import { IExtensionDescription, ExtensionIdentifier } from '../src/common/vscode';

// 临时绕过
export const mockExtensionProps: IExtensionProps & { uri?: Uri } = {
  name: 'sumi-extension',
  id: 'test.sumi-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, 'extension'),
  realPath: '/home/.sumi/extensions/test.sumi-extension-1.0.0',
  uri: Uri.file(path.join(__dirname, 'extension')).toJSON() as Uri,
  extensionId: 'uuid-for-test-extension',
  extensionLocation: Uri.file(path.join(__dirname, 'extension')),
  isUseEnable: true,
  enableProposedApi: true,
  isBuiltin: false,
  packageJSON: {
    name: 'sumi-extension',
    main: './index.js',
    version: '0.0.1',
  },
  extendConfig: {
    node: {
      main: './node.js',
    },
    worker: {
      main: './worker.js',
    },
    componentId: ['FakeComponentId'],
  },
  workerScriptPath: 'http://some-host/__mocks__/extension/worker.js',
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
};

export const mockExtensionProps2: IExtensionProps = {
  ...mockExtensionProps,
  extendConfig: {},
  path: path.join(__dirname, 'extension-error'),
  name: 'sumi-extension-error',
  id: 'test.sumi-extension-error',
  extensionId: 'uuid-for-test-extension-2',
  extensionLocation: Uri.file(path.join(__dirname, 'extension-error')),
  workerScriptPath: 'http://some-host/__mocks__/extension-error/worker.error.js',
  packageJSON: {
    name: 'sumi-extension-error',
    main: './index.js',
    version: '0.0.1',
    kaitianContributes: {
      viewsProxies: ['FakeComponentId'],
      nodeMain: './index.js',
      workerMain: './worker.error.js',
    },
  },
};

export const mockExtensionDescription: IExtensionDescription = {
  ...mockExtensionProps,
  identifier: new ExtensionIdentifier(mockExtensionProps.id),
  isUnderDevelopment: false,
  publisher: mockExtensionProps.packageJSON.publisher,
  version: mockExtensionProps.packageJSON.version,
  engines: mockExtensionProps.packageJSON.engines,
  contributes: mockExtensionProps.packageJSON.contributes,
};

export const mockExtension: IExtension = {
  ...mockExtensionProps,
  contributes: {},
  activate: () => {},
  enable: () => {},
  reset: () => {},
  toJSON: () => mockExtensionProps,
};

export const mockExtensions: IExtensionDescription[] = [mockExtensionDescription];
