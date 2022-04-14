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

describe('Extension Service', () => {
  let injector: Injector;
  let extensionService: IExtensionNodeService;
  const extensionDir = path.join(__dirname, '../../__mocks__/extensions');
  const testExtId = 'opensumi.ide-dark-theme';
  const testExtPath = 'opensumi.ide-dark-theme-1.13.1';
  const testExtReadme = '# IDE Dark Theme';

  beforeAll(async () => {
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
              timeEnd: () => 1,
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
    let mockExtClientId = 'mock_id123';
    beforeEach(() => {
      mockExtClientId = 'mock_id' + Math.random();
    });

    afterEach(async () => {
      await extensionService.disposeClientExtProcess(mockExtClientId, true);
    });

    // jest.setTimeout(20 * 1000);

    it('should create extension host process', async () => {
      await extensionService.createProcess(mockExtClientId);
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(port).toBeUndefined();
    });

    it.skip('enable extProcess inspect port', async () => {
      (global as any).isDev = undefined;
      await extensionService.createProcess(mockExtClientId);

      const res = await extensionService.tryEnableInspectPort(mockExtClientId, 2000);
      expect(res).toBeTruthy();

      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
    });

    it('create extension host process with develop mode', async () => {
      (global as any).isDev = 1;
      await extensionService.createProcess(mockExtClientId);
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
      (global as any).isDev = undefined;
    });

    it('create extension host process with enable extension host options', async () => {
      (global as any).isDev = undefined;
      await extensionService.createProcess(mockExtClientId, {
        enableDebugExtensionHost: true,
      });
      const port = await extensionService.getProcessInspectPort(mockExtClientId);
      expect(typeof port).toBe('number');
    });

    it('should create connect listenPath', async () => {
      const listenPath = await extensionService.getElectronMainThreadListenPath2(mockExtClientId);
      expect(path.dirname(listenPath)).toBe(path.join(os.tmpdir(), 'sumi-ipc'));
    });
    it('should create ext server listen option', async () => {
      const { port, path: listenPath } = await extensionService.getExtServerListenOption(mockExtClientId);

      if (port) {
        expect(typeof port).toBe('number');
      } else {
        expect(path.dirname(listenPath)).toBe(path.join(os.tmpdir(), 'sumi-ipc'));
      }
    });
  });
});
