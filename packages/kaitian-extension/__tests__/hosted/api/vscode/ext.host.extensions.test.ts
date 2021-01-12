import * as path from 'path';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { URI } from '@ali/ide-core-common';
import { initMockRPCProtocol } from '../../../__mock__/initRPCProtocol';
import { KTWorkerExtensionContext } from '../../../../src/hosted/api/vscode/ext.host.extensions';
import { ExtHostStorage } from '../../../../src/hosted/api/vscode/ext.host.storage';

const staticServicePath = 'http://localhost:9999';

const mockExtension = {
  name: 'kaitian-extension',
  id: 'mock.kaitian-extension',
  path: path.join(__dirname, '../__mock__/extension'),
  realPath: path.join(__dirname, '../__mock__/extension'),
  extensionId: 'mock.kaitian-extension',
  extensionLocation: new URI(`${staticServicePath}/assets${path.join(__dirname, '../__mock__/extension')}`).codeUri,
  packageJSON: {
    name: 'kaitian-extension',
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
  let context: KTWorkerExtensionContext;
  const mockClient = {
    send: async (msg) => {},
    onMessage: (fn) => {},
  };
  beforeAll(async () => {
    rpcProtocol = await initMockRPCProtocol(mockClient);
    context = new KTWorkerExtensionContext({
      extensionId: mockExtension.extensionId,
      extendProxy: {},
      registerExtendModuleService: () => {},
      extensionPath: mockExtension.realPath,
      extensionLocation: mockExtension.extensionLocation,
      staticServicePath,
      storageProxy: new ExtHostStorage(rpcProtocol),
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
  });
});
