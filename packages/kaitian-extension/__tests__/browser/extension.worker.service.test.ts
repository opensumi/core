import { Injectable } from '@ali/common-di';
import * as path from 'path';

import { ExtensionService, IExtension, IExtensionProps } from '../../src/common';
import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { WorkerExtensionService } from '../../src/browser/extension.worker.service';
import { IContextKeyService, ILoggerManagerClient, StorageProvider, DefaultStorageProvider, PreferenceProvider, AppConfig, Uri, CommandRegistryImpl, CommandRegistry, IPreferenceSettingsService, KeybindingRegistryImpl, KeybindingRegistry, IFileServiceClient } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { IThemeService, IIconService } from '@ali/ide-theme/lib/common';
import { IconService } from '@ali/ide-theme/lib/browser';
import { DatabaseStorageContribution } from '@ali/ide-storage/lib/browser/storage.contribution';
import { IWorkspaceStorageServer, IGlobalStorageServer } from '@ali/ide-storage';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IExtensionStorageService } from '@ali/ide-extension-storage';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { WSChanneHandler, WSChannel } from '@ali/ide-connection';
import { IEditorDocumentModelContentRegistry, IEditorDocumentModelService, IEditorActionRegistry } from '@ali/ide-editor/lib/browser';
import { MockPreferenceProvider } from '@ali/ide-core-browser/lib/mocks/preference';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common/file-search';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMenuRegistry, MenuRegistryImpl } from '@ali/ide-core-browser/src/menu/next';
import { EditorActionRegistryImpl } from '@ali/ide-editor/lib/browser/menu/editor.menu';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { LayoutService } from '@ali/ide-main-layout/lib/browser/layout.service';
import { PreferenceSettingsService } from '@ali/ide-preferences/lib/browser/preference.service';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { MonacoSnippetSuggestProvider } from '@ali/ide-monaco/lib/browser/monaco-snippet-suggest-provider';
import { IActivationEventService } from '@ali/ide-kaitian-extension/lib/browser/types';
import { ActivationEventServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/activation.service';
import { Disposable } from '@ali/ide-core-common';
import { IWebviewService } from '@ali/ide-webview';
import { ICommentsService } from '@ali/ide-comments';
import { CommentsService } from '@ali/ide-comments/lib/browser/comments.service';
import { WorkerHostAPIIdentifier, IExtensionWorkerHost } from '../../src/common';
import { MessageChannel, MessagePort, MockWorker } from '../__mock__/worker';

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
(global as any).amdLoader.require = (global as any).amdLoader;
(global as any).amdLoader.require.config = (global as any).amdLoader.config;

@Injectable()
class MockWorkbenchEditorService {
  open() { }
  apply() { }
  editorGroups = [];
  onActiveResourceChange() {
    return Disposable.NULL;
  }
}

(global as any).Worker = MockWorker;
(global as any).MessagePort = MessagePort;
(global as any).MessageChannel = MessageChannel;

const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, '../__mock__/extension'),
  realPath: path.join(__dirname, '../__mock__/extension'),
  extensionId: 'uuid-for-test-extension',
  isUseEnable: true,
  enableProposedApi: false,
  isBuiltin: false,
  isDevelopment: false,
  packageJSON: {
    name: 'kaitian-extension',
    extensionDependencies: ['uuid-for-test-extension-deps'],
  },
  extendConfig: {
    browser: {
      main: 'browser.js',
    },
    worker: {
      main: 'worker.js',
    },
  },
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
};

const mockExtension = {
  ...mockExtensionProps,
  contributes: mockExtensionProps.packageJSON.contributes,
  activate: () => {
    return true;
  },
  toJSON: () => mockExtensionProps,
};

const mockExtensions: IExtension[] = [mockExtension];

describe('Extension Worker Service', () => {
  let workerService: WorkerExtensionService;
  let injector: MockInjector;

  beforeAll((done) => {
    injector = createBrowserInjector([], new MockInjector([DatabaseStorageContribution,  {
      token: AppConfig,
      useValue: {
        noExtHost: true,
        extWorkerHost: 'http://localhost:57889/lib/worker-host.js',
      },
    }]));

    injector.addProviders(
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: WorkerExtensionService,
        useClass: WorkerExtensionService,
      },
      {
        token: StaticResourceService,
        useValue: {
          resolveStaticResource(uri) {
            return Uri.parse('http://localhost:57889/__tests__/__mock__/extension/worker.js');
          },
        },
      },
      {
        token: CommandRegistry,
        useClass: CommandRegistryImpl,
      },
      {
        token: IMenuRegistry,
        useClass: MenuRegistryImpl,
      },
      {
        token: IWebviewService,
        useValue: mockService({}),
      },
      {
        token: IEditorActionRegistry,
        useClass: EditorActionRegistryImpl,
      },
      {
        token: ICommentsService,
        useClass: CommentsService,
      },
      {
        token: IMainLayoutService,
        useClass: LayoutService,
      },
      {
        token: IPreferenceSettingsService,
        useClass: PreferenceSettingsService,
      },
      {
        token: KeybindingRegistry,
        useClass: KeybindingRegistryImpl,
      },
      {
        token: IActivationEventService,
        useClass: ActivationEventServiceImpl,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IWorkspaceStorageServer,
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
        token: IGlobalStorageServer,
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
        useClass: WorkbenchThemeService,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: MonacoSnippetSuggestProvider,
        useClass: MonacoSnippetSuggestProvider,
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
    );

    workerService = injector.get(WorkerExtensionService);
    done();
  });

  it('initExtension should be work', async () => {
    await workerService.initExtension(mockExtensions);
    expect(workerService.getExtension(mockExtension.id)).toBeDefined();
    expect(workerService.getExtension(mockExtension.id)!.id).toBe(mockExtension.id);
  });

  it('activate worker host should be work', async () => {
    await workerService.activate(true);
    expect(workerService.protocol).toBeDefined();
    const proxy = workerService.protocol.getProxy<IExtensionWorkerHost>(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
    expect(proxy).toBeDefined();
  });

  it('activate extension should be work', async () => {
    await workerService.activeExtension(mockExtension);
    const activated = await workerService.getActivatedExtensions();
    expect(activated.find((e) => e.id === mockExtension.id)).toBeTruthy();
  });
});
