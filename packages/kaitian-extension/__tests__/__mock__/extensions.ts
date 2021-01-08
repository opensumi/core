import * as path from 'path';
import { Uri } from '@ali/ide-core-common';
import { IExtensionProps, IExtension } from '../../src/common';

export const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, 'extension'),
  realPath: '/home/.kaitian/extensions/test.kaitian-extension-1.0.0',
  extensionId: 'uuid-for-test-extension',
  extensionLocation: Uri.file(path.join(__dirname, 'extension')),
  isUseEnable: true,
  enableProposedApi: false,
  isBuiltin: false,
  packageJSON: {
    name: 'kaitian-extension',
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
  workerScriptPath: 'http://some-host/__tests__/__mock__/extension/worker.js',
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
};

export const mockExtensionProps2: IExtensionProps = {
  ...mockExtensionProps,
  extendConfig: {},
  path: path.join(__dirname, 'extension-error'),
  name: 'kaitian-extension-error',
  id: 'test.kaitian-extension-error',
  extensionId: 'uuid-for-test-extension-2',
  extensionLocation: Uri.file(path.join(__dirname, 'extension-error')),
  workerScriptPath: 'http://some-host/__tests__/__mock__/extension-error/worker.error.js',
  packageJSON: {
    name: 'kaitian-extension-error',
    main: './index.js',
    version: '0.0.1',
    kaitianContributes: {
      viewsProxies: ['FakeComponentId'],
      nodeMain: './index.js',
      workerMain: './worker.error.js',
    },
  },
};

export const mockExtensions: IExtension[] = [{
  ...mockExtensionProps,
  contributes: mockExtensionProps.packageJSON.contributes,
  activate: () => {
    return true;
  },
  toJSON: () => mockExtensionProps,
}];
