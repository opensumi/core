import { BrowserModule, Domain, PreferenceContribution, URI, FileUri, PreferenceProviderProvider, PreferenceScope, PreferenceProvider, PreferenceService, PreferenceServiceImpl, injectPreferenceConfigurations, injectPreferenceSchemaProvider } from '@ali/ide-core-browser';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IFileServiceClient, IDiskFileProvider, IShadowFileProvider } from '@ali/ide-file-service';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { PreferencesModule } from '@ali/ide-preferences/lib/browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Injectable, Provider } from '@ali/common-di';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileResourceResolver } from '@ali/ide-file-service/lib/browser/file-service-contribution';
import { DiskFileSystemProvider } from '@ali/ide-file-service/lib/node/disk-file-system.provider';
import { ShadowFileSystemProvider } from '@ali/ide-file-service/lib/browser/shadow-file-system.provider';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';

@Injectable()
export class AddonModule extends BrowserModule {
  providers: Provider[] = [
    EditorPreferenceContribution,
    FileResourceResolver,
    {
      token: IShadowFileProvider,
      useClass: ShadowFileSystemProvider,
    },
    {
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    },
    {
      token: IFileServiceClient,
      useClass: FileServiceClient,
    },
  ];
}

@Domain(PreferenceContribution)
export class EditorPreferenceContribution implements PreferenceContribution {
  readonly schema = {
    type: 'object',
    properties: {
      'editor.fontSize': {
        'type': 'number',
        'default': 12,
        'description': 'Controls the font size in pixels.',
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

    await fs.ensureDir(root.withoutScheme().toString());
    await fs.ensureDir(path.join(root.withoutScheme().toString(), '.kaitian'));
    await fs.writeJSON(path.join(root.withoutScheme().toString(), '.kaitian', 'settings.json'), {
      'editor.fontSize': 16,
    });
    await fs.ensureDir(path.join(root.withoutScheme().toString(), 'userhome', '.kaitian'));
    await fs.writeJSON(path.join(root.withoutScheme().toString(), 'userhome', '.kaitian', 'settings.json'), {
      'editor.fontSize': 20,
    });

    injector = createBrowserInjector([
      AddonModule,
      PreferencesModule,
    ]);
    // 覆盖文件系统中的getCurrentUserHome方法，便于用户设置测试
    injector.mock(IFileServiceClient, 'getCurrentUserHome', () => {
      return {
        uri: root!.resolve('userhome').toString(),
        isDirectory: true,
        lastModification: new Date().getTime(),
      };
    });

    mockWorkspaceService = {
      roots: [root.toString()],
      workspace: {
        isDirectory: true,
        lastModification: new Date().getTime(),
        uri: root.toString(),
      },
      tryGetRoots: () => [{
        isDirectory: true,
        lastModification: new Date().getTime(),
        uri: root!.toString(),
      }],
      onWorkspaceChanged: jest.fn(),
      onWorkspaceLocationChanged: jest.fn(),
      isMultiRootWorkspaceOpened: false,
    };

    // Mock
    injector.addProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });

    injectPreferenceConfigurations(injector);
    injectPreferenceSchemaProvider(injector);

    const preferencesProviderFactory = () => {
      return (scope: PreferenceScope) => {
        const provider: PreferenceProvider = injector.get(PreferenceProvider, { tag: scope });
        provider.asScope(scope);
        return provider;
      };
    };

    // 用于获取不同scope下的PreferenceProvider
    injector.overrideProviders({
      token: PreferenceProviderProvider,
      useFactory: preferencesProviderFactory,
    }, {
      token: PreferenceService,
      useClass: PreferenceServiceImpl,
    });

    preferenceService = injector.get(PreferenceService);

    done();
  });

  afterAll(async () => {
    if (root) {
      await fs.remove(root.withoutScheme().toString());
    }
    root = null;
  });

  describe('01 #Init', () => {

    it('should have enough API', async () => {
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
      await preferenceService.ready;
      preferenceService.onPreferenceChanged((change) => {
        // 在文件夹目录情况下，设置配置仅会触发一次工作区配置变化事件
        if (change.preferenceName === testPreferenceName && change.scope === PreferenceScope.Workspace) {
          done();
        }
      });
      preferenceService.set(testPreferenceName, 28);
    });
  });
});
