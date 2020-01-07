import { Injectable } from '@ali/common-di';
import { ExtensionService, IExtensionNodeClientService, ExtraMetaData, IExtensionMetaData, IExtension, IExtensionProps, ExtensionNodeServiceServerPath } from '../../lib/common';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { IContextKeyService, ILoggerManagerClient, StorageProvider, DefaultStorageProvider, createContributionProvider, StorageResolverContribution, PreferenceProvider } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { IThemeService, IIconService } from '@ali/ide-theme/lib/common';
import { IconService } from '@ali/ide-theme/lib/browser';
import { DatabaseStorageContribution } from '@ali/ide-storage/lib/browser/storage.contribution';
import { WorkspaceStorageServerPath, GlobalStorageServerPath } from '@ali/ide-storage';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { WSChanneHandler, WSChannel } from '@ali/ide-connection';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { MockPreferenceProvider } from '@ali/ide-core-browser/lib/mocks/preference';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common/file-search';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() {},
    };
  }
}

(global as any).amdLoader = require('../../../../tools/dev-tool/vendor/loader.js');

const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: '/home/.kaitian/extensions/test.kaitian-extension-1.0.0',
  realPath: '/home/.kaitian/extensions/test.kaitian-extension-1.0.0',
  extensionId: 'uuid-for-test-extension',
  isUseEnable: true,
  enableProposedApi: false,
  isBuiltin: false,
  packageJSON: {
    name: 'kaitian-extension',
  },
  extendConfig: {},
  extraMetadata: {},
  packageNlsJSON: {},
  deafaultPkgNlsJSON: {},
};

(global as any).Worker = class {
  constructor(url) { }

  postMessage(msg) {
    //
  }
};

@Injectable()
class MockWorkbenchEditorService {
  open() { }
  apply() { }
}

const mockExtensions: IExtension[] = [{
  ...mockExtensionProps,
  activate: () => {
    return true;
  },
  toJSON: () => mockExtensionProps,
}];

@Injectable()
class MockExtNodeClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]> {
    return Promise.resolve(mockExtensions);
  }
  createProcess(clientId: string): Promise<void> {
    return Promise.resolve();
  }
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData | undefined): Promise<IExtensionMetaData | undefined> {
    return Promise.resolve({ ...mockExtensionProps, extraMetadata: { ...extraMetaData } });
  }
  infoProcessNotExist(): void {
    throw new Error('Method not implemented.');
  }
  infoProcessCrash(): void {
    throw new Error('Method not implemented.');
  }
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateLanguagePack(languageId: string, languagePackPath: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

describe('Extension service', () => {
  let extensionService: ExtensionService;
  let injector: MockInjector;

  beforeAll(() => {
    injector = createBrowserInjector([], new MockInjector([DatabaseStorageContribution]));
    injector.addProviders(
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: WorkspaceStorageServerPath,
        useValue: {
          getItems(key) {
            return JSON.stringify({ language: 'zh_CN' });
          },
          init() {
            return Promise.resolve();
          },
        },
      },
      {
        token: IExtensionStorageService,
        useValue: {
          whenReady: Promise.resolve(true),
          extensionStoragePath: {},
          set() { },
          get() { },
          getAll() { },
          reConnectInit() { },
        },
      },
      {
        token: GlobalStorageServerPath,
        useValue: {
          getItems(key) {
            return JSON.stringify({ language: 'zh_CN' });
          },
          init() {
            return Promise.resolve();
          },
        },
      },
      {
        token: FileSearchServicePath,
        useValue: {
          find: () => Promise.resolve([]),
        },
      },
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IEditorDocumentModelContentRegistry,
        useValue: {
          registerEditorDocumentModelContentProvider() { },
          getProvider() { },
          getContentForUri() { },
        },
      },
      {
        token: IEditorDocumentModelService,
        useValue: {
          createModelReference() { },
          getAllModels() { return []; },
        },
      },
      {
        token: IThemeService,
        useValue: {
          applyTheme: () => {
          },
        },
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkbenchEditorService,
      },
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManagerClient,
      },
      {
        token: StorageProvider,
        useFactory: () => {
          return (storageId) => {
            return injector.get(DefaultStorageProvider).get(storageId);
          };
        },
      },
      {
        token: PreferenceProvider,
        useClass: MockPreferenceProvider,
      },
      {
        token: WSChanneHandler,
        useValue: {
          clientId: 'mock_id' + Math.random(),
          openChannel() {
            const channelSend = (content) => {
              //
            };
            return new WSChannel(channelSend, 'mock_wschannel');
          },
        },
      },
      {
        token: ExtensionNodeServiceServerPath,
        useClass: MockExtNodeClientService,
      },
    );

    createContributionProvider(injector, StorageResolverContribution);
    extensionService = injector.get(ExtensionService);
    // const nodeClient = new MockExtNodeClientService();
    // injector.mock(ExtensionService, 'extensionNodeService', nodeClient);
  });

  describe('activate', () => {
    it('should activate extension service.', async (done) => {
      await extensionService.activate();
      done();
    });

    it.skip('should activate mock extension', async () => {
      await extensionService.activeExtension(mockExtensions[0]);
    });
  });

  describe('get extension', () => {
    it('should return all mock extensions', async () => {
      const exts = await extensionService.getAllExtensions();
      expect(exts).toEqual(mockExtensions);
    });

    it('should return all mock extensions JSON', async () => {
      const jsons = await extensionService.getAllExtensionJson();
      expect(jsons).toEqual(mockExtensions.map((e) => e.toJSON()));
    });

    it('should return specified extension props', async () => {
      const extensionMetadata = await extensionService.getExtensionProps(mockExtensionProps.path, { readme: './README.md' });
      expect(extensionMetadata?.extraMetadata).toEqual({ readme: './README.md' });
    });

  });

  describe('extension status sync', () => {
    it('should return false when extension is not runnint', async () => {
      const activated = await extensionService.isExtensionRunning(mockExtensionProps.path);
      expect(activated).toBe(false);
    });
  });

  describe('extension host commands', () => {
    it(`should define a command in 'node' host.`, async (done) => {
      const commandId = 'mock_command';
      const disposable = extensionService.declareExtensionCommand(commandId, 'node');
      const host = extensionService.getExtensionCommand(commandId);
      expect(host).toBe('node');
      disposable.dispose();
      expect(extensionService.getExtensionCommand(commandId)).toBe(undefined);
      done();
    });
  });
});
