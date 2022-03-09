import path from 'path';

import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { IExtensionProps, URI } from '@opensumi/ide-core-common';

import { initMockRPCProtocol } from '../../../../__mocks__/initRPCProtocol';
import { ExtensionMode } from '../../../../src/common/vscode/ext-types';
import { ExtensionContext } from '../../../../src/hosted/api/vscode/ext.host.extensions';
import { ExtHostSecret } from '../../../../src/hosted/api/vscode/ext.host.secrets';
import { ExtHostStorage } from '../../../../src/hosted/api/vscode/ext.host.storage';
import { ExtensionWorkerHost } from '../../../../src/hosted/worker.host';

const staticServicePath = 'http://localhost:9999';

const mockExtension = {
  name: 'sumi-extension',
  id: 'mock.sumi-extension',
  path: path.join(__dirname, '../../../../__mocks__/extension'),
  realPath: path.join(__dirname, '../../../../__mocks__/extension'),
  extensionId: 'mock.sumi-extension',
  extensionLocation: new URI(`${staticServicePath}/assets${path.join(__dirname, '../../../../__mocks__/extension')}`)
    .codeUri,
  packageJSON: {
    name: 'sumi-extension',
    kaitianContributes: {
      workerMain: 'worker.js',
    },
  },
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
};

describe(`test ${__filename}`, () => {
  let rpcProtocol: RPCProtocol;
  let context: ExtensionContext;
  let extHostStorage: ExtHostStorage;

  const injector = new Injector();
  const mockClient = {
    send: async (msg) => {},
    onMessage: (fn) => {},
  };
  beforeAll(async () => {
    rpcProtocol = await initMockRPCProtocol(mockClient);
    extHostStorage = new ExtHostStorage(rpcProtocol);
    context = new ExtensionContext({
      extensionDescription: mockExtension as unknown as IExtensionProps,
      isDevelopment: false,
      extensionId: mockExtension.extensionId,
      extendProxy: {},
      createExtension: (extensionDescription: IExtensionProps) =>
        new ExtensionWorkerHost(rpcProtocol, injector).createExtension(extensionDescription),
      registerExtendModuleService: () => {},
      extensionPath: mockExtension.realPath,
      extensionLocation: mockExtension.extensionLocation,
      storageProxy: extHostStorage,
      secretProxy: new ExtHostSecret(rpcProtocol),
    });
  });

  describe('context', () => {
    it('extensionUri', () => {
      expect(context.extensionUri).toEqual(mockExtension.extensionLocation);
    });

    it('extensionPath', () => {
      expect(context.extensionPath).toBe(mockExtension.extensionLocation.fsPath);
    });

    it('asAbsolutePath', () => {
      const filePath = './server.js';
      expect(context.asAbsolutePath(filePath)).toBe(path.join(mockExtension.extensionLocation.fsPath, filePath));
    });

    it('extensionMode', () => {
      expect(context.extensionMode).toBe(ExtensionMode.Production);
    });

    it('path in unix is valid', async () => {
      await extHostStorage.$acceptStoragePath({
        logUri: URI.file('/User/log').codeUri,
        storageUri: URI.file('/User/storage').codeUri,
        globalStorageUri: URI.file('/User/globalStorage').codeUri,
      });
      expect(context.logPath).toBe('/User/log');
      expect(context.storagePath).toBe('/User/storage');
      expect(context.globalStoragePath).toBe('/User/globalStorage');
    });

    it('path in windows is valid', async () => {
      await extHostStorage.$acceptStoragePath({
        logUri: URI.file('c:\\User\\log').codeUri,
        storageUri: URI.file('c:\\User\\storage').codeUri,
        globalStorageUri: URI.file('c:\\User\\globalStorage').codeUri,
      });
      expect(context.logPath).toBe('c:\\User\\log');
      expect(context.storagePath).toBe('c:\\User\\storage');
      expect(context.globalStoragePath).toBe('c:\\User\\globalStorage');
    });
  });
});
