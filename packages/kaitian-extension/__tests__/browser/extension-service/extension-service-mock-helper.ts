import { Injectable, Provider } from '@ali/common-di';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionService, IExtensionNodeClientService, IExtraMetaData, IExtensionMetaData, IExtension, IExtensionProps, ExtensionNodeServiceServerPath, IExtCommandManagement, AbstractExtensionManagementService, IRequireInterceptorService, RequireInterceptorService, RequireInterceptorContribution } from '../../../src/common';
import { MockInjector, mockService } from '../../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { ExtensionServiceImpl } from '../../../src/browser/extension.service';
import { IContextKeyService, ILoggerManagerClient, StorageProvider, DefaultStorageProvider, createContributionProvider, StorageResolverContribution, PreferenceProvider, AppConfig, Uri, CommandRegistryImpl, CommandRegistry, IPreferenceSettingsService, KeybindingRegistryImpl, KeybindingRegistry, IFileServiceClient, ISchemaRegistry, ISchemaStore, URI, Disposable } from '@ali/ide-core-browser';
import { MockContextKeyService } from '../../../../monaco/__mocks__/monaco.context-key.service';
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
import { MockPreferenceProvider } from '@ali/ide-core-browser/__mocks__/preference';
import { FileSearchServicePath } from '@ali/ide-file-search/lib/common/file-search';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';
import { IMenuRegistry, MenuRegistryImpl } from '@ali/ide-core-browser/src/menu/next';
import { EditorActionRegistryImpl } from '@ali/ide-editor/lib/browser/menu/editor.menu';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { LayoutService } from '@ali/ide-main-layout/lib/browser/layout.service';
import { PreferenceSettingsService } from '@ali/ide-preferences/lib/browser/preference-settings.service';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { MonacoSnippetSuggestProvider } from '@ali/ide-monaco/lib/browser/monaco-snippet-suggest-provider';
import { AbstractExtInstanceManagementService, IActivationEventService } from '@ali/ide-kaitian-extension/lib/browser/types';
import { ActivationEventServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/activation.service';
import { SchemaRegistry, SchemaStore } from '@ali/ide-monaco/lib/browser/schema-registry';
import { ExtCommandManagementImpl } from '../../../src/browser/extension-command-management';
import { ExtInstanceManagementService } from '../../../src/browser/extension-instance-management';
import { ExtensionManagementService } from '../../../src/browser/extension-management.service';
import { AbstractNodeExtProcessService, AbstractViewExtProcessService, AbstractWorkerExtProcessService } from '../../../src/common/extension.service';
import { NodeExtProcessService } from '../../../src/browser/extension-node.service';
import { WorkerExtProcessService } from '../../../src/browser/extension-worker.service';
import { ViewExtProcessService } from '../../../src/browser/extension-view.service';
import { MockWorker, MessagePort } from '../../../__mocks__/worker';
import { IWebviewService } from '@ali/ide-webview';
import { ICommentsService } from '@ali/ide-comments';
import { CommentsService } from '@ali/ide-comments/lib/browser/comments.service';
import { BrowserRequireInterceptorContribution } from '@ali/ide-kaitian-extension/lib/browser/require-interceptor.contribution';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() { },
    };
  }
}

const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, '../../__mocks__/extension'),
  realPath: path.join(__dirname, '../../__mocks__/extension'),
  extensionLocation: Uri.file(path.join(__dirname, '../../__mocks__/extension')),
  extensionId: 'uuid-for-test-extension',
  isUseEnable: true,
  enableProposedApi: false,
  isBuiltin: false,
  isDevelopment: false,
  packageJSON: {
    name: 'kaitian-extension',
    extensionDependencies: ['uuid-for-test-extension-deps'],
    kaitianContributes: {
      viewsProxies: [
        'Leftview',
        'TitleView',
      ],
      browserViews: {
        left: {
          type: 'add',
          view: [
            {
              id: 'KaitianViewContribute',
              icon: 'extension',
              title: 'KAIITAN 视图贡献点',
            },
            {
              id: 'Leftview',
              title: 'leftview',
              icon: 'extension',
              titleComponentId: 'TitleView',
            },
          ],
        },
      },
      browserMain: path.join(__dirname, '../../__mocks__/extension/browser.js'),
    },
    contributes: {
      'actions': [
        { type: 'action', title: 'test action' },
      ],
      'commands': [{
        'command': 'HelloKaitian',
        'title': 'HelloKaitian',
        'icon': 'icon.svg',
      }],
      'keybindings': [
        {
          'command': 'HelloKaitian',
          'key': 'ctrl+f1',
          'mac': 'cmd+f1',
          'when': 'editorTextFocus',
        },
      ],
      'menus': {
        'editor/title': [
          {
            'when': '!isIdeRunning',
            'command': 'HelloKaitian',
            'group': 'navigation',
          },
        ],
        'editor/context': [
          {
            'when': 'isIdeRunning',
            'command': 'HelloKaitian',
          },
        ],
      },
      'viewsContainers': {
        'activitybar': [
          {
            'id': 'package-explorer',
            'title': 'Package Explorer',
            'icon': 'icon.svg',
          },
          {
            'id': 'hold-container',
            'title': 'Test Hold',
            'icon': 'icon.svg',
          },
        ],
      },
      'views': {
        'explorer': [
          {
            'id': 'mockviews',
            'name': 'Mock Views',
            'when': 'workspaceHasPackageJSON',
          },
        ],
        'package-explorer': [
          {
            'id': 'mockviews',
            'name': 'Mock Views',
          },
        ],
      },
      'configuration': {
        'title': 'Mock Extension Config',
        'properties': {
          'mockext.useCodeSnippetsOnMethodSuggest': {
            'type': 'boolean',
            'default': false,
            'description': 'Complete functions with their parameter signature.',
          },
        },
      },
      'colors': [
        {
          'id': 'mock.superstatus.error',
          'description': 'Color for error message in the status bar.',
          'defaults': {
            'dark': '#ff004f',
            'light': '#ff004f',
            'highContrast': '#010203',
          },
        },
      ],
      'snippets': [
        {
          'language': 'javascript',
          'path': './javascript.json',
        },
      ],
    },
  },
  extendConfig: {
    worker: {
      main: path.join(__dirname, '../../../__mocks__/extension/worker.js'),
    },
  },
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
};

@Injectable()
class MockWorkbenchEditorService {
  open() { }
  apply() { }
  editorGroups = [];
  onActiveResourceChange = () => Disposable.NULL;
}

const mockExtension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.path),
  contributes: Object.assign(mockExtensionProps.packageJSON.contributes, mockExtensionProps.packageJSON.kaitianContributes),
  activate: () => {
    return true;
  },
  enable() { },
  toJSON: () => mockExtensionProps,
  addDispose() { },
};

export const MOCK_EXTENSIONS: IExtension[] = [mockExtension];

@Injectable()
class MockExtNodeClientService implements IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: IExtraMetaData): Promise<IExtensionMetaData[]> {
    return Promise.resolve(MOCK_EXTENSIONS);
  }
  createProcess(clientId: string): Promise<void> {
    return Promise.resolve();
  }
  getExtension(extensionPath: string, localization: string, extraMetaData?: IExtraMetaData | undefined): Promise<IExtensionMetaData | undefined> {
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

function mockGlobals() {
  (global as any).fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: async () => fs.readFileSync(path.join(__dirname, '../../../__mocks__/extension/browser-new.js'), 'utf8'),
  });

  (global as any).amdLoader = require('../../../../../tools/dev-tool/vendor/loader.js');
  (global as any).amdLoader.require = (global as any).amdLoader;
  (global as any).amdLoader.require.config = (global as any).amdLoader.config;

  (global as any).Worker = MockWorker;
  (global as any).MessagePort = MessagePort;

}

export const mockKaitianExtensionProviders: Provider[] = [
  {
    token: IExtCommandManagement,
    useClass: ExtCommandManagementImpl,
  },
  {
    token: AbstractExtInstanceManagementService,
    useClass: ExtInstanceManagementService,
  },
  {
    token: AbstractExtensionManagementService,
    useClass: ExtensionManagementService,
  },
  {
    token: AbstractNodeExtProcessService,
    useClass: NodeExtProcessService,
  },
  {
    token: AbstractWorkerExtProcessService,
    useClass: WorkerExtProcessService,
  },
  {
    token: AbstractViewExtProcessService,
    useClass: ViewExtProcessService,
  },
  {
    token: ExtensionService,
    useClass: ExtensionServiceImpl,
  },
];

export function setupExtensionServiceInjector() {
  mockGlobals();

  const injector = createBrowserInjector([], new MockInjector([DatabaseStorageContribution, {
    token: AppConfig,
    useValue: {
      noExtHost: true,
      extWorkerHost: path.join(__dirname, '../../lib/worker-host.js'),
    },
  }]));
  injector.addProviders(
    ...mockKaitianExtensionProviders,
    {
      token: StaticResourceService,
      useValue: {
        resolveStaticResource(uri: URI) {
          return uri.withScheme('file');
        },
        resourceRoots: () => [],
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
      token: WorkbenchEditorService,
      useClass: MockWorkbenchEditorService,
    },
    {
      token: IWebviewService,
      useValue: mockService({}),
    },
    {
      token: ICommentsService,
      useClass: CommentsService,
    },
    {
      token: IEditorActionRegistry,
      useClass: EditorActionRegistryImpl,
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
    {
      token: ExtensionNodeServiceServerPath,
      useClass: MockExtNodeClientService,
    },
    {
      token: ISchemaStore,
      useClass: SchemaStore,
    },
    {
      token: ISchemaRegistry,
      useClass: SchemaRegistry,
    },
    {
      token: IRequireInterceptorService,
      useClass: RequireInterceptorService,
    },
    BrowserRequireInterceptorContribution,
  );

  createContributionProvider(injector, StorageResolverContribution);
  createContributionProvider(injector, MainLayoutContribution);
  createContributionProvider(injector, RequireInterceptorContribution);

  return injector;
}
