import path from 'path';

import { URI as Uri } from 'vscode-uri';

import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { IExtensionProps, isWindows, URI } from '@opensumi/ide-core-common';

import { initMockRPCProtocol } from '../../../../__mocks__/initRPCProtocol';
import { ExtensionMode } from '../../../../src/common/vscode/ext-types';
import { ExtensionContext } from '../../../../src/hosted/api/vscode/ext.host.extensions';
import { ExtHostSecret } from '../../../../src/hosted/api/vscode/ext.host.secrets';
import { ExtHostStorage } from '../../../../src/hosted/api/vscode/ext.host.storage';
import { ExtensionWorkerHost } from '../../../../src/hosted/worker.host';

const staticServicePath = 'http://localhost:9999';

const extensionId = 'mock.sumi-extension';

const mockExtension = {
  name: 'sumi-extension',
  id: extensionId,
  path: path.join(__dirname, '../../../../__mocks__/extension'),
  realPath: path.join(__dirname, '../../../../__mocks__/extension'),
  extensionId,
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
      const logUri = URI.file('/User/log');
      await extHostStorage.$acceptStoragePath({
        logUri,
        storageUri: URI.file('/User/storage'),
        globalStorageUri: URI.file('/User/globalStorage'),
      });
      // ensure logUri is 'vscode-uri' interface
      expect(context.logUri instanceof Uri).toBe(true);
      expect(context.logPath).toBe(`/User/log/${extensionId}`);
      expect(context.storagePath).toBe(`/User/storage/${extensionId}`);
      expect(context.globalStoragePath).toBe(`/User/globalStorage/${extensionId}`);
    });

    (isWindows ? it : it.skip)('path in windows is valid', async () => {
      await extHostStorage.$acceptStoragePath({
        logUri: URI.file('c:\\User\\log'),
        storageUri: URI.file('c:\\User\\storage'),
        globalStorageUri: URI.file('c:\\User\\globalStorage'),
      });
      expect(context.logPath).toBe(`c:\\User\\log\\${extensionId}`);
      expect(context.storagePath).toBe(`c:\\User\\storage\\${extensionId}`);
      expect(context.globalStoragePath).toBe(`c:\\User\\globalStorage\\${extensionId}`);
    });
  });
});
