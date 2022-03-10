import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';

import { Injector } from '@opensumi/di';
import { AppConfig, INodeLogger, IReporterService, getDebugLogger } from '@opensumi/ide-core-node';
import { ActivationEventServiceImpl } from '@opensumi/ide-extension/lib/browser/activation.service';
import { IActivationEventService } from '@opensumi/ide-extension/lib/browser/types';

import { createNodeInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IExtensionNodeService, IExtensionNodeClientService, IExtensionHostManager } from '../../src/common';
import { ExtensionHostManager } from '../../src/node/extension.host.manager';
import { ExtensionNodeServiceImpl } from '../../src/node/extension.service';
import { ExtensionServiceClientImpl } from '../../src/node/extension.service.client';


describe('Extension Serivce', () => {
  let injector: Injector;
  let extensionService: IExtensionNodeService;
  const extensionDir = path.join(__dirname, '../../__mocks__/extensions');
  const testExtId = 'opensumi.ide-dark-theme';
  const testExtPath = 'opensumi.ide-dark-theme-1.13.1';
  const testExtReadme = '# IDE Dark Theme';

  beforeAll(async (done) => {
    injector = createNodeInjector([]);
    injector.addProviders(
      {
        token: AppConfig,
        useValue: {
          marketplace: {
            extensionDir,
            ignoreId: [],
          },
        },
      },
      {
        token: IReporterService,
        useValue: {
          point() {
            //
          },
          performance() {
            //
          },
          time() {
            return {
              timeEnd: () => {
                //
              },
            };
          },
        },
      },
      {
        token: INodeLogger,
        useValue: getDebugLogger(),
      },
      {
        token: IActivationEventService,
        useClass: ActivationEventServiceImpl,
      },
      {
        token: IExtensionNodeService,
        useClass: ExtensionNodeServiceImpl,
      },
      {
        token: IExtensionNodeClientService,
        useClass: ExtensionServiceClientImpl,
      },
      {
        token: IExtensionHostManager,
        useClass: ExtensionHostManager,
      },
    );

    extensionService = injector.get(IExtensionNodeService);
    done();
  });

  afterAll(async () => {
    const extensionHostManager = injector.get(IExtensionHostManager);
    await extensionHostManager.dispose();
    injector.disposeAll();
  });

  describe('get all extensions', () => {
    it('should return all extension and equals dirs', async () => {
      const extensions = await extensionService.getAllExtensions([extensionDir], [], 'zh_CN', {});
      const dirs = fs.readdirSync(extensionDir);

      expect(extensions.map((e) => path.basename(e.realPath)).sort()).toEqual(dirs.sort());

      expect(extensions.length).toBe(dirs.length);
    });

    it('should return all extension and contains extraMetadata', async () => {
      const extension = await extensionService.getAllExtensions([extensionDir], [], 'zh_CN', { readme: './README.md' });
      const expectExtension = extension.find((e) => e.id === testExtId);
      expect(expectExtension?.extraMetadata.readme.trim()).toBe(testExtReadme);
    });
  });

  describe('get extension', () => {
    it('should return extension', async () => {
      const extension = await extensionService.getExtension(path.join(extensionDir, testExtPath), 'zh_CN', {});
      expect(path.basename(extension!.realPath)).toBe(testExtPath);
    });

    it('should return a extension and contains extraMetadata', async () => {
      const extension = await extensionService.getExtension(path.join(extensionDir, testExtPath), 'zh_CN', {
        readme: './README.md',
      });
      expect(extension?.extraMetadata.readme.trim()).toBe(testExtReadme);
    });
  });

  describe('extension host process', () => {
    it('should create extension host process', async () => {
      const mockExtClientId = 'mock_id' + Math.random();
      await extensionService.createProcess(mockExtClientId);
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(port).toBeUndefined();
      await extensionService.disposeClientExtProcess(mockExtClientId, true);
    });

    it.skip('enable extProcess inspect port', async (done) => {
      (global as any).isDev = undefined;
      const mockExtClientId = 'mock_id' + Math.random();
      await extensionService.createProcess(mockExtClientId);

      const res = await extensionService.tryEnableInspectPort(mockExtClientId, 2000);
      expect(res).toBeTruthy();

      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
      await extensionService.disposeClientExtProcess(mockExtClientId, true);
      done();
    });

    it('create extension host process with develop mode', async () => {
      (global as any).isDev = 1;
      const mockExtClientId = 'mock_id' + Math.random();
      await extensionService.createProcess(mockExtClientId);
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
      await extensionService.disposeClientExtProcess(mockExtClientId, false);
      (global as any).isDev = undefined;
    });

    it('create extension host process with enable extension host options', async () => {
      (global as any).isDev = undefined;
      const mockExtClientId = 'mock_id' + Math.random();
      await extensionService.createProcess(mockExtClientId, {
        enableDebugExtensionHost: true,
      });
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
      await extensionService.disposeClientExtProcess(mockExtClientId, false);
    });
  });

  describe('getElectronMainThreadListenPath', () => {
    it('should create connect listenPath', () => {
      const mockExtClientId = 'mock_id' + Math.random();

      const listenPath = extensionService.getElectronMainThreadListenPath2(mockExtClientId);
      expect(path.dirname(listenPath)).toBe(path.join(os.tmpdir(), 'sumi-ipc'));
    });
  });

  describe('getExtServerListenOption', () => {
    it('should create ext server listen option', async () => {
      const mockExtClientId = 'mock_id' + Math.random();

      const { port, path: listenPath } = await extensionService.getExtServerListenOption(mockExtClientId);

      if (port) {
        expect(typeof port).toBe('number');
      } else {
        expect(path.dirname(listenPath)).toBe(path.join(os.tmpdir(), 'sumi-ipc'));
      }
    });
  });
});
