import fs from 'fs';
import os from 'os';
import path from 'path';

import { Injectable, Provider } from '@opensumi/di';
import { ICommentsService } from '@opensumi/ide-comments';
import { CommentsService } from '@opensumi/ide-comments/lib/browser/comments.service';
import { WSChannel } from '@opensumi/ide-connection';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser/ws-channel-handler';
import {
  IContextKeyService,
  StorageProvider,
  DefaultStorageProvider,
  createContributionProvider,
  StorageResolverContribution,
  PreferenceProvider,
  AppConfig,
  Uri,
  CommandRegistryImpl,
  CommandRegistry,
  IPreferenceSettingsService,
  KeybindingRegistryImpl,
  KeybindingRegistry,
  IFileServiceClient,
  IJSONSchemaRegistry,
  ISchemaStore,
  URI,
  Disposable,
  ICryptoService,
  ICredentialsService,
  Emitter,
  AppLifeCycleServiceToken,
} from '@opensumi/ide-core-browser';
import { MockPreferenceProvider } from '@opensumi/ide-core-browser/__mocks__/preference';
import { AppLifeCycleService } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { IMenuRegistry, MenuRegistryImpl } from '@opensumi/ide-core-browser/src/menu/next';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelContentRegistry,
  IEditorDocumentModelService,
  IEditorActionRegistry,
  EditorComponentRegistry,
  ResourceService,
} from '@opensumi/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@opensumi/ide-editor/lib/browser/component';
import { EditorActionRegistryImpl } from '@opensumi/ide-editor/lib/browser/menu/editor.menu';
import { ResourceServiceImpl } from '@opensumi/ide-editor/lib/browser/resource.service';
import { ActivationEventServiceImpl } from '@opensumi/ide-extension/lib/browser/activation.service';
import { BrowserRequireInterceptorContribution } from '@opensumi/ide-extension/lib/browser/require-interceptor.contribution';
import {
  AbstractExtInstanceManagementService,
  IActivationEventService,
} from '@opensumi/ide-extension/lib/browser/types';
import { WalkthroughsService } from '@opensumi/ide-extension/lib/browser/walkthroughs.service';
import { IExtensionStoragePathServer, IExtensionStorageService } from '@opensumi/ide-extension-storage';
import { FileSearchServicePath } from '@opensumi/ide-file-search/lib/common/file-search';
import { MockFileServiceClient } from '@opensumi/ide-file-service/__mocks__/file-service-client';
import { IMainLayoutService, MainLayoutContribution } from '@opensumi/ide-main-layout';
import { LayoutService } from '@opensumi/ide-main-layout/lib/browser/layout.service';
import { MonacoSnippetSuggestProvider } from '@opensumi/ide-monaco/lib/browser/monaco-snippet-suggest-provider';
import { SchemaRegistry, SchemaStore } from '@opensumi/ide-monaco/lib/browser/schema-registry';
import { PreferenceSettingsService } from '@opensumi/ide-preferences/lib/browser/preference-settings.service';
import { IWorkspaceStorageServer, IGlobalStorageServer } from '@opensumi/ide-storage';
import { DatabaseStorageContribution } from '@opensumi/ide-storage/lib/browser/storage.contribution';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { SemanticTokenRegistryImpl } from '@opensumi/ide-theme/lib/browser/semantic-tokens-registry';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';
import { IThemeService, IIconService } from '@opensumi/ide-theme/lib/common';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import { IWebviewService } from '@opensumi/ide-webview';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import { IWorkspaceFileService } from '@opensumi/ide-workspace-edit';
import { WorkspaceFileService } from '@opensumi/ide-workspace-edit/lib/browser/workspace-file.service';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { mockService } from '../../../../../tools/dev-tool/src/mock-injector';
import { MockContextKeyService } from '../../../../monaco/__mocks__/monaco.context-key.service';
import { MockExtNodeClientService } from '../../../__mocks__/extension.service.client';
import { MockWorker, MessagePort } from '../../../__mocks__/worker';
import { ExtCommandManagementImpl } from '../../../src/browser/extension-command-management';
import { ExtInstanceManagementService } from '../../../src/browser/extension-instance-management';
import { ExtensionManagementService } from '../../../src/browser/extension-management.service';
import { NodeExtProcessService } from '../../../src/browser/extension-node.service';
import { ViewExtProcessService } from '../../../src/browser/extension-view.service';
import { WorkerExtProcessService } from '../../../src/browser/extension-worker.service';
import { ExtensionServiceImpl } from '../../../src/browser/extension.service';
import { SumiContributionsService, SumiContributionsServiceToken } from '../../../src/browser/sumi/contributes';
import { VSCodeContributesService, VSCodeContributesServiceToken } from '../../../src/browser/vscode/contributes';
import {
  ExtensionService,
  IExtension,
  IExtensionProps,
  ExtensionNodeServiceServerPath,
  IExtCommandManagement,
  AbstractExtensionManagementService,
  IRequireInterceptorService,
  RequireInterceptorService,
  RequireInterceptorContribution,
} from '../../../src/common';
import {
  AbstractNodeExtProcessService,
  AbstractViewExtProcessService,
  AbstractWorkerExtProcessService,
} from '../../../src/common/extension.service';
import { MockExtensionStorageService } from '../../hosted/__mocks__/extensionStorageService';

const mockExtensionProps: IExtensionProps = {
  name: 'sumi-extension',
  id: 'test.sumi-extension',
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
    name: 'sumi-extension',
    extensionDependencies: ['uuid-for-test-extension-deps'],
    sumiContributes: {
      viewsProxies: ['Leftview', 'TitleView'],
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
      actions: [{ type: 'action', title: 'test action' }],
      commands: [
        {
          command: 'HelloKaitian',
          title: 'HelloKaitian',
          icon: 'icon.svg',
        },
        {
          command: 'Test',
          title: '%test.label%',
          category: '%test.category%',
        },
      ],
      keybindings: [
        {
          command: 'HelloKaitian',
          key: 'ctrl+f1',
          mac: 'cmd+f1',
          when: 'editorTextFocus',
        },
      ],
      menus: {
        'editor/title': [
          {
            when: '!isIdeRunning',
            command: 'HelloKaitian',
            group: 'navigation',
          },
        ],
        'editor/context': [
          {
            when: 'isIdeRunning',
            command: 'HelloKaitian',
          },
        ],
      },
      viewsContainers: {
        activitybar: [
          {
            id: 'package-explorer',
            title: 'Package Explorer',
            icon: 'icon.svg',
          },
          {
            id: 'hold-container',
            title: 'Test Hold',
            icon: 'icon.svg',
          },
        ],
      },
      views: {
        explorer: [
          {
            id: 'mockviews',
            name: 'Mock Views',
            when: 'workspaceHasPackageJSON',
          },
        ],
        'package-explorer': [
          {
            id: 'mockviews',
            name: 'Mock Views',
          },
        ],
      },
      configuration: {
        title: 'Mock Extension Config',
        properties: {
          'mockext.useCodeSnippetsOnMethodSuggest': {
            type: 'boolean',
            default: false,
            description: 'Complete functions with their parameter signature.',
          },
        },
      },
      colors: [
        {
          id: 'mock.superstatus.error',
          description: 'Color for error message in the status bar.',
          defaults: {
            dark: '#ff004f',
            light: '#ff004f',
            highContrast: '#010203',
          },
        },
      ],
      snippets: [
        {
          language: 'javascript',
          path: './javascript.json',
        },
      ],
      walkthroughs: [
        {
          id: 'sample',
          title: 'Sample',
          description: 'A sample walkthrough',
          steps: [
            {
              id: 'runcommand',
              title: 'Run Command',
              description:
                '$(git-commit) This step will run a command and check off once it has been run.\n[Run Command](command:getting-started-sample.runCommand)',
              media: {
                image: 'media/image.png',
                altText: 'Empty image',
              },
              completionEvents: ['onCommand:getting-started-sample.runCommand'],
            },
            {
              id: 'usesvg',
              title: "Use SVG's",
              description:
                'Try out using SVG\'s in your content, they can react to the theme (try: ``var(--vscode-foreground)``) and even host command links (try: ``xlink:href="command:``)',
              media: {
                svg: 'media/image.svg',
                altText: 'Empty svg image',
              },
            },
            {
              id: 'mac',
              title: 'UI Platform: Mac',
              description: 'This step will only show on a Mac.',
              when: 'isMac',
              media: {
                markdown: 'media/mac.md',
              },
            },
          ],
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
  packageNlsJSON: {
    'test.label': 'this is label',
    'test.category': 'this is category',
  },
  defaultPkgNlsJSON: {
    'test.label': 'this is alias',
    'test.category': 'this is aliasCategory',
  },
};

@Injectable()
class MockWorkbenchEditorService {
  open() {}
  apply() {}
  editorGroups = [];
  onActiveResourceChange = () => Disposable.NULL;
  onActiveEditorUriChange = () => Disposable.NULL;
}

const mockExtension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.path),
  contributes: Object.assign(
    mockExtensionProps.packageJSON.contributes,
    mockExtensionProps.packageJSON.sumiContributes,
  ),
  activate: () => true,
  reset() {},
  enable() {},
  toJSON: () => mockExtensionProps,
  getDefaultIcon: () => '',
  addDispose() {},
};

export const MOCK_EXTENSIONS: IExtension[] = [mockExtension];

function mockGlobals() {
  (global as any).fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    text: async () => fs.readFileSync(path.join(__dirname, '../../../__mocks__/extension/browser-new.js'), 'utf8'),
  });

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
  {
    token: EditorComponentRegistry,
    useClass: EditorComponentRegistryImpl,
  },
  {
    token: ResourceService,
    useClass: ResourceServiceImpl,
  },
];

export function setupExtensionServiceInjector() {
  mockGlobals();

  const injector = createBrowserInjector([]);
  injector.overrideProviders(
    ...mockKaitianExtensionProviders,
    DatabaseStorageContribution,
    {
      token: AppConfig,
      useValue: {
        isElectronRenderer: false,
        isRemote: true,
        noExtHost: true,
        extWorkerHost: path.join(__dirname, '../../lib/worker-host.js'),
      },
    },
    {
      token: ISemanticTokenRegistry,
      useClass: SemanticTokenRegistryImpl,
    },
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
      token: AppLifeCycleServiceToken,
      useClass: AppLifeCycleService,
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
      useValue: MockExtensionStorageService,
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
      token: IExtensionStoragePathServer,
      useValue: {
        getLastStoragePath() {
          return os.tmpdir();
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
        registerEditorDocumentModelContentProvider() {},
        getProvider() {},
        getContentForUri() {},
      },
    },
    {
      token: IEditorDocumentModelService,
      useValue: {
        createModelReference() {},
        getAllModels() {
          return [];
        },
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
      token: StorageProvider,
      useFactory: () => (storageId) => injector.get(DefaultStorageProvider).get(storageId),
    },
    {
      token: PreferenceProvider,
      useClass: MockPreferenceProvider,
    },
    {
      token: WSChannelHandler,
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
      token: IJSONSchemaRegistry,
      useClass: SchemaRegistry,
    },
    {
      token: IRequireInterceptorService,
      useClass: RequireInterceptorService,
    },
    {
      token: IWorkspaceFileService,
      useClass: WorkspaceFileService,
    },
    {
      token: WalkthroughsService,
      useClass: WalkthroughsService,
    },
    BrowserRequireInterceptorContribution,
  );

  injector.overrideProviders(
    {
      token: ICryptoService,
      useValue: mockService({}),
    },
    {
      token: ICredentialsService,
      useValue: mockService({
        onDidChangePassword: new Emitter().event,
      }),
    },
    {
      token: VSCodeContributesServiceToken,
      useClass: VSCodeContributesService,
    },
    {
      token: SumiContributionsServiceToken,
      useClass: SumiContributionsService,
    },
  );

  createContributionProvider(injector, StorageResolverContribution);
  createContributionProvider(injector, MainLayoutContribution);
  createContributionProvider(injector, RequireInterceptorContribution);

  return injector;
}
