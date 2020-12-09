import * as path from 'path';
import { UriComponents } from 'vscode-uri';
import { RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { URI } from '@ali/ide-core-common';
import { initMockRPCProtocol } from '../../../__mock__/initRPCProtocol';
import { KTWorkerExtensionContext } from '../../../../src/hosted/api/vscode/ext.host.extensions';
import { ExtHostStorage } from '../../../../src/hosted/api/vscode/ext.host.storage';

const mockExtension = {
  name: 'kaitian-extension',
  id: 'mock.kaitian-extension',
  path: path.join(__dirname, '../__mock__/extension'),
  realPath: path.join(__dirname, '../__mock__/extension'),
  extensionId: 'mock.kaitian-extension',
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
  const staticServicePath = 'http://localhost:9999';
  const resolveStaticResource = (uri: UriComponents): UriComponents => {
    const _uri = URI.from(uri);
    return _uri.scheme !== 'file'
      ? _uri.withScheme('http').codeUri
      : new URI(staticServicePath)
          .withPath('assets')
          .withQuery(`path=${_uri.codeUri.fsPath}`).codeUri;
  };
  beforeAll(async () => {
    rpcProtocol = await initMockRPCProtocol(mockClient);
    context = new KTWorkerExtensionContext({
      extensionId: mockExtension.extensionId,
      extendProxy: {},
      registerExtendModuleService: () => {},
      extensionPath: mockExtension.realPath,
      staticServicePath,
      storageProxy: new ExtHostStorage(rpcProtocol),
      async resolveStaticResource(uri: URI) {
        const assetUriComponent = resolveStaticResource(uri.codeUri);
        return URI.from(assetUriComponent);
      },
    });
  });

  describe('context.asHref', () => {
    it('should get corrent href in normal scene', async () => {
      let filePath = './server.js';
      expect(await context.asHref(filePath)).toBe(
        `${staticServicePath}/assets?path=${path.join(mockExtension.path, filePath)}`,
      );

      filePath = 'server.js';
      expect(await context.asHref(filePath)).toBe(
        `${staticServicePath}/assets?path=${path.join(mockExtension.path, filePath)}`,
      );
    });

    it('should get href in normal scene', async () => {
      const _extensionPath = (context as any)._extensionPath;
      (context as any)._extensionPath = 'kt-ext://cdn.net/__mock__/extension';
      const filePath = './server.js';
      expect(await context.asHref(filePath)).toBe(
        `http://cdn.net/__mock__/extension/server.js`,
      );
      (context as any)._extensionPath = _extensionPath;
    });
  });
});
