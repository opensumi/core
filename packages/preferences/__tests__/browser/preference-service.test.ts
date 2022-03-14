import os from 'os';
import path from 'path';

import * as fs from 'fs-extra';

import { Injectable, Provider } from '@opensumi/di';
import {
  BrowserModule,
  Domain,
  PreferenceContribution,
  URI,
  FileUri,
  PreferenceProviderProvider,
  PreferenceScope,
  PreferenceProvider,
  PreferenceService,
  PreferenceServiceImpl,
  injectPreferenceConfigurations,
  injectPreferenceSchemaProvider,
  IEventBus,
  ILoggerManagerClient,
} from '@opensumi/ide-core-browser';
import { MockLoggerManageClient } from '@opensumi/ide-core-browser/__mocks__/logger';
import { IFileServiceClient, IDiskFileProvider } from '@opensumi/ide-file-service';
import { FileServiceClientModule } from '@opensumi/ide-file-service/lib/browser';
import { FileServiceContribution } from '@opensumi/ide-file-service/lib/browser/file-service-contribution';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { PreferencesModule } from '@opensumi/ide-preferences/lib/browser';
import { UserStorageContribution } from '@opensumi/ide-preferences/lib/browser/userstorage';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

@Injectable()
export class AddonModule extends BrowserModule {
  providers: Provider[] = [EditorPreferenceContribution, UserStorageContribution];
}

@Domain(PreferenceContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  readonly schema = {
    type: 'object',
    properties: {
      'editor.fontSize': {
        type: 'number',
        default: 12,
        description: 'Controls the font size in pixels.',
      },
      'java.config.xxx': {
        type: 'boolean',
        description: '',
      },
      'java.config.yyy': {
        type: 'boolean',
        description: '',
      },
    },
  } as any;
}

describe('PreferenceService should be work', () => {
  let injector: MockInjector;
  let preferenceService: PreferenceService;
  let root: URI | null;

  let mockWorkspaceService;

  beforeAll(async (done) => {
    root = FileUri.create(path.join(os.tmpdir(), 'preference-service-test'));

    await fs.ensureDir(root.path.toString());
    await fs.ensureDir(path.join(root.path.toString(), '.sumi'));
    await fs.writeJSON(path.join(root.path.toString(), '.sumi', 'settings.json'), {
      'editor.fontSize': 16,
    });
    await fs.ensureDir(path.join(root.path.toString(), 'userhome', '.sumi'));
    await fs.writeJSON(path.join(root.path.toString(), 'userhome', '.sumi', 'settings.json'), {
      'editor.fontSize': 20,
    });

    injector = createBrowserInjector([FileServiceClientModule, AddonModule, PreferencesModule]);

    injector.overrideProviders({
      token: IWorkspaceService,
      useValue: {
        isMultiRootWorkspaceOpened: false,
        workspace: {
          uri: root.toString(),
          isDirectory: true,
          lastModification: new Date().getTime(),
        },
        roots: Promise.resolve([
          {
            uri: root.toString(),
            isDirectory: true,
            lastModification: new Date().getTime(),
          },
        ]),
        onWorkspaceChanged: () => {},
        onWorkspaceLocationChanged: () => {},
        tryGetRoots: () => [
          {
            uri: root!.toString(),
            isDirectory: true,
            lastModification: new Date().getTime(),
          },
        ],
      },
    });

    injector.overrideProviders({
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    });

    // 覆盖文件系统中的getCurrentUserHome方法，便于用户设置测试
    injector.mock(IFileServiceClient, 'getCurrentUserHome', () => ({
      uri: root!.resolve('userhome').toString(),
      isDirectory: true,
      lastModification: new Date().getTime(),
    }));

    injector.mock(IEventBus, 'fireAndAwait', () => {});

    mockWorkspaceService = {
      roots: [root.toString()],
      workspace: {
        isDirectory: true,
        lastModification: new Date().getTime(),
        uri: root.toString(),
      },
      tryGetRoots: () => [
        {
          isDirectory: true,
          lastModification: new Date().getTime(),
          uri: root!.toString(),
        },
      ],
      onWorkspaceChanged: jest.fn(),
      onWorkspaceLocationChanged: jest.fn(),
      isMultiRootWorkspaceOpened: false,
    };

    // Mock
    injector.addProviders(
      {
        token: IWorkspaceService,
        useValue: mockWorkspaceService,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
    );

    injectPreferenceConfigurations(injector);
    injectPreferenceSchemaProvider(injector);

    const preferencesProviderFactory = () => (scope: PreferenceScope) => {
      const provider: PreferenceProvider = injector.get(PreferenceProvider, { tag: scope });
      provider.asScope(scope);
      return provider;
    };

    // 用于获取不同scope下的PreferenceProvider
    injector.overrideProviders(
      {
        token: PreferenceProviderProvider,
        useFactory: preferencesProviderFactory,
      },
      {
        token: PreferenceService,
        useClass: PreferenceServiceImpl,
      },
    );

    // PreferenceService 的初始化时机要更早
    preferenceService = injector.get(PreferenceService);

    const fileServiceContribution = injector.get(FileServiceContribution);
    const userStorageContribution = injector.get(UserStorageContribution);

    await fileServiceContribution.initialize();
    await userStorageContribution.initialize();

    await preferenceService.ready;

    done();
  });

  afterAll(async () => {
    if (root) {
      await fs.remove(root.path.toString());
    }
    root = null;
    injector.disposeAll();
  });

  describe('01 #Init', () => {
    it('should have enough API', () => {
      expect(typeof preferenceService.ready).toBe('object');
      expect(typeof preferenceService.dispose).toBe('function');
      expect(typeof preferenceService.get).toBe('function');
      expect(typeof preferenceService.getProvider).toBe('function');
      expect(typeof preferenceService.hasLanguageSpecific).toBe('function');
      expect(typeof preferenceService.inspect).toBe('function');
      expect(typeof preferenceService.resolve).toBe('function');
      expect(typeof preferenceService.set).toBe('function');
      expect(typeof preferenceService.onLanguagePreferencesChanged).toBe('function');
      expect(typeof preferenceService.onPreferenceChanged).toBe('function');
      expect(typeof preferenceService.onPreferencesChanged).toBe('function');
      expect(typeof preferenceService.onSpecificPreferenceChange).toBe('function');
    });

    it('preferenceChanged event should emit once while setting preference', async (done) => {
      const testPreferenceName = 'editor.fontSize';
      const dispose = preferenceService.onPreferenceChanged((change) => {
        // 在文件夹目录情况下，设置配置仅会触发一次工作区配置变化事件
        if (change.preferenceName === testPreferenceName && change.scope === PreferenceScope.Workspace) {
          dispose.dispose();
          done();
        }
      });
      await preferenceService.set(testPreferenceName, 28);
    });

    it('onPreferencesChanged/onSpecificPreferenceChange event should be worked', async (done) => {
      const testPreferenceName = 'editor.fontSize';
      await preferenceService.ready;
      const dispose1 = preferenceService.onPreferencesChanged((changes) => {
        for (const preferenceName of Object.keys(changes)) {
          if (preferenceName === testPreferenceName && changes[preferenceName].scope === PreferenceScope.Workspace) {
            dispose1.dispose();
            done();
          }
        }
      });
      const dispose2 = preferenceService.onSpecificPreferenceChange(testPreferenceName, (change) => {
        // 在文件夹目录情况下，设置配置仅会触发一次工作区配置变化事件
        if (change.newValue === 30) {
          dispose2.dispose();
          done();
        }
      });
      await preferenceService.set(testPreferenceName, 30, PreferenceScope.Workspace);
    });

    it('setting multiple value once should be worked', async (done) => {
      const preferences = {
        'java.config.xxx': false,
        'java.config.yyy': true,
      };
      for (const key of Object.keys(preferences)) {
        await preferenceService.set(key, preferences[key]);
        const value = preferenceService.get(key);
        expect(value).toBe(preferences[key]);
      }
      done();
    });

    it('inspect preference with preferenceName should be worked', async (done) => {
      const testPreferenceName = 'editor.fontSize';
      await preferenceService.set(testPreferenceName, 12, PreferenceScope.User);
      await preferenceService.set(testPreferenceName, 14, PreferenceScope.Workspace);
      const value = preferenceService.inspect(testPreferenceName);
      expect(value?.preferenceName).toBe(testPreferenceName);
      expect(value?.globalValue).toBe(12);
      expect(value?.workspaceValue).toBe(14);
      done();
    });

    it('getProvider method should be worked', () => {
      expect(preferenceService.getProvider(PreferenceScope.User)).toBeDefined();
      expect(preferenceService.getProvider(PreferenceScope.Workspace)).toBeDefined();
    });

    it('resolve method should be work', async (done) => {
      const testPreferenceName = 'editor.fontSize';
      await preferenceService.set(testPreferenceName, 20, PreferenceScope.Workspace);
      const unknownPreferenceName = 'editor.unknown';
      expect(preferenceService.resolve(testPreferenceName).value).toBe(20);
      expect(preferenceService.resolve(unknownPreferenceName).value).toBeUndefined();
      expect(preferenceService.resolve(unknownPreferenceName, 'default').value).toBe('default');
      done();
    });
  });
});
