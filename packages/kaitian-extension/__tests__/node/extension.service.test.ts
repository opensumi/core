import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { Injector } from '@ali/common-di';
import { AppConfig, INodeLogger } from '@ali/ide-core-node';

import { ExtensionNodeServiceImpl } from '../../src/node/extension.service';
import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IExtensionNodeService, IExtensionNodeClientService } from '../../src/common';
import { ExtensionServiceClientImpl } from '../../src/node/extension.service.client';

describe('Extension Serivce', () => {
  let injector: Injector;
  let extensionService: IExtensionNodeService;
  const extensionDir = path.join(__dirname, '../__mock__/extensions');
  const testExtId = 'kaitian.ide-dark-theme';
  const testExtPath = 'kaitian.ide-dark-theme-1.13.1';
  const testExtReadme = '# IDE Dark Theme';

  beforeAll(async (done) => {
    injector = createNodeInjector([]);
    injector.addProviders({
      token: AppConfig,
      useValue: {
        marketplace: {
          extensionDir,
          ignoreId: [],
        },
      },
    }, {
      token: INodeLogger,
      useValue: {
        /* tslint:disable */
        log: console.log,
        error: console.error,
        /* tslint:enable */
      },
    },
      {
        token: IExtensionNodeService,
        useClass: ExtensionNodeServiceImpl,
      },
      {
        token: IExtensionNodeClientService,
        useClass: ExtensionServiceClientImpl,
      },
    );

    extensionService = injector.get(IExtensionNodeService);
    done();
  });

  describe('get all extensions', () => {
    it('should return all extension and equals dirs', async () => {
      const extensions = await extensionService.getAllExtensions([extensionDir], [], 'zh_CN', {});
      const dirs = fs.readdirSync(extensionDir);

      expect(extensions.map((e) => path.basename(e.realPath)).sort()).toEqual(dirs.sort());

      expect(extensions.length).toBe(dirs.length);
    });

    it.skip('should return all extension and contains extraMetadata', async () => {
      const extension = await extensionService.getAllExtensions([extensionDir], [], 'zh_CN', { readme: './README.md' });
      const expectExtension = extension.find((e) => e.id = testExtId);
      expect(expectExtension?.extraMetadata.readme.trim()).toBe(testExtReadme);
    });
  });

  describe('get extension', () => {
    it('should return extension', async () => {
      const extension = await extensionService.getExtension(path.join(extensionDir, testExtPath), 'zh_CN', {});
      expect(path.basename(extension!.realPath)).toBe(testExtPath);
    });

    it('should return a extension and contains extraMetadata', async () => {
      const extension = await extensionService.getExtension(path.join(extensionDir, testExtPath), 'zh_CN', { readme: './README.md' });
      expect(extension?.extraMetadata.readme.trim()).toBe(testExtReadme);
    });
  });

  describe('createProcess2', () => {
    it.skip('should create extension host process', async (done) => {
      const mockExtClientId = 'mock_id' + Math.random();
      const extProcess = extensionService.createProcess2(mockExtClientId);

      expect(extProcess).toBeInstanceOf(Promise);
      await extensionService.disposeClientExtProcess(mockExtClientId, true);
      done();
    });
  });

  describe('getElectronMainThreadListenPath', () => {
    it('should create connect listenpath', () => {
      const mockExtClientId = 'mock_id' + Math.random();

      const listenpath = extensionService.getElectronMainThreadListenPath2(mockExtClientId);
      expect(path.dirname(listenpath)).toBe(path.join(os.tmpdir(), 'kaitian-ipc'));
    });
  });

  describe('getExtServerListenPath', () => {
    it('should create ext server listenpath', () => {
      const mockExtClientId = 'mock_id' + Math.random();

      const listenpath = extensionService.getExtServerListenPath(mockExtClientId);
      expect(path.dirname(listenpath)).toBe(path.join(os.tmpdir(), 'kaitian-ipc'));
    });
  });
});
