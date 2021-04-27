import { Injectable } from '@ali/common-di';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionService, IExtensionNodeClientService, ExtraMetaData, IExtensionMetaData, IExtension, IExtensionProps, ExtensionNodeServiceServerPath } from '../../src/common';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { IContextKeyService, ILoggerManagerClient, StorageProvider, DefaultStorageProvider, createContributionProvider, StorageResolverContribution, PreferenceProvider, AppConfig, Uri, CommandRegistryImpl, CommandRegistry, IPreferenceSettingsService, PreferenceScope, KeybindingRegistryImpl, KeybindingRegistry, IFileServiceClient, ISchemaRegistry, ISchemaStore, URI } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-monaco/lib/browser/mocks/monaco.context-key.service';
import { IThemeService, IIconService, getColorRegistry } from '@ali/ide-theme/lib/common';
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
import { IMenuRegistry, MenuRegistryImpl, IMenuItem } from '@ali/ide-core-browser/src/menu/next';
import { EditorActionRegistryImpl } from '@ali/ide-editor/lib/browser/menu/editor.menu';
import { IMainLayoutService, MainLayoutContribution } from '@ali/ide-main-layout';
import { LayoutService } from '@ali/ide-main-layout/lib/browser/layout.service';
import { PreferenceSettingsService } from '@ali/ide-preferences/lib/browser/preference.service';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { MonacoSnippetSuggestProvider } from '@ali/ide-monaco/lib/browser/monaco-snippet-suggest-provider';
import { IToolbarRegistry } from '@ali/ide-core-browser/lib/toolbar';
import { NextToolbarRegistryImpl } from '@ali/ide-core-browser/src/toolbar/toolbar.registry';
import { IActivationEventService, ExtensionBeforeActivateEvent } from '@ali/ide-kaitian-extension/lib/browser/types';
import { ActivationEventServiceImpl } from '@ali/ide-kaitian-extension/lib/browser/activation.service';
import { SchemaRegistry, SchemaStore } from '@ali/ide-monaco/lib/browser/schema-registry';
import { TabbarService } from '@ali/ide-main-layout/lib/browser/tabbar/tabbar.service';

@Injectable()
class MockLoggerManagerClient {
  getLogger = () => {
    return {
      log() { },
      debug() { },
      error() { },
      verbose() { },
      warn() { },
      dispose() {},
    };
  }
}

(global as any).amdLoader = require('../../../../tools/dev-tool/vendor/loader.js');
(global as any).amdLoader.require = (global as any).amdLoader;
(global as any).amdLoader.require.config = (global as any).amdLoader.config;

const mockExtensionProps: IExtensionProps = {
  name: 'kaitian-extension',
  id: 'test.kaitian-extension',
  activated: false,
  enabled: true,
  path: path.join(__dirname, '../__mock__/extension'),
  realPath: path.join(__dirname, '../__mock__/extension'),
  extensionLocation: Uri.file(path.join(__dirname, '../__mock__/extension')),
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
      browserMain: path.join(__dirname, '../__mock__/extension/browser.js'),
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
  extendConfig: {},
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
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

const mockExtension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.path),
  contributes: Object.assign(mockExtensionProps.packageJSON.contributes, mockExtensionProps.packageJSON.kaitianContributes),
  activate: () => {
    return true;
  },
  toJSON: () => mockExtensionProps,
};

class MockExtNodeClientService implements IExtensionNodeClientService {

  constructor(private mockExtensionProps: IExtensionProps, private mockExtensions: IExtension[]) {
  }

  getElectronMainThreadListenPath(clientId: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]> {
    return Promise.resolve(this.mockExtensions);
  }
  createProcess(clientId: string): Promise<void> {
    return Promise.resolve();
  }
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData | undefined): Promise<IExtensionMetaData | undefined> {
    return Promise.resolve({ ...this.mockExtensionProps, extraMetadata: { ...extraMetaData } });
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
  const originFetch = (global as any).fetch;
  let mockExtensions: IExtension[];

  beforeEach(async () => {
    mockExtensions = [mockExtension];
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => fs.readFileSync(path.join(__dirname, '../__mock__/extension/browser-new.js'), 'utf8'),
    });
    injector = createBrowserInjector([], new MockInjector([DatabaseStorageContribution, {
      token: AppConfig,
      useValue: {
        noExtHost: true,
      },
    }]));
    createContributionProvider(injector, StorageResolverContribution);
    createContributionProvider(injector, MainLayoutContribution);
    injector.addProviders(
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: StaticResourceService,
        useValue: {
          resolveStaticResource(uri: URI) {
            return uri.withScheme('file');
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
        useValue: new MockExtNodeClientService(mockExtensionProps, mockExtensions),
      },
      {
        token: ISchemaStore,
        useClass: SchemaStore,
      },
      {
        token: ISchemaRegistry,
        useClass: SchemaRegistry,
      },
    );

    injector.get(IMainLayoutService).viewReady.resolve();
    extensionService = injector.get(ExtensionService);
    await extensionService.activate();
  });

  afterEach(() => {
    (global as any).fetch = originFetch;
    injector.disposeAll();
  });

  describe('activate', () => {

    it('emit event before activate', async () => {
      const cb = jest.fn();

      // @ts-ignore
      extensionService.eventBus.on(ExtensionBeforeActivateEvent, cb);

      // @ts-ignore
      await extensionService.doActivate();
      expect(cb).toBeCalled();
    });

    it('emit onStartupFinished activationEvent after activate', async () => {
      const cb = jest.fn();
      const activationEventService = injector.get<IActivationEventService>(IActivationEventService);
      activationEventService.onEvent('onStartupFinished', cb);
      // @ts-ignore
      await extensionService.doActivate();
      expect(cb).toBeCalled();
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

    it('should return extension by extensionId', async () => {
      const extension = extensionService.getExtensionByExtId('test.kaitian-extension');
      expect(extension?.extensionId).toBe(mockExtension.extensionId);
    });
  });

  describe('extension status sync', () => {
    it('should return false when extension is not running', async () => {
      const activated = await extensionService.isExtensionRunning(mockExtensionProps.path);
      expect(activated).toBe(false);
    });
  });

  describe('activate extension', () => {
    it('should activate mock browser extension without ext process', async (done) => {
      await extensionService.activeExtension(mockExtensions[0]);
      const layoutService: IMainLayoutService = injector.get(IMainLayoutService);
      const tabbarService: TabbarService = layoutService.getTabbarService('left');
      const containerInfo = tabbarService.getContainer('test.kaitian-extension:Leftview');
      expect(containerInfo?.options?.titleComponent).toBeDefined();
      expect(containerInfo?.options?.titleProps).toBeDefined();
      setTimeout(() => {
        done();
      }, 1000);
    });

    it('extension should not repeated activation', async () => {
      const extensions = await extensionService.getExtensions();
      expect(extensions).toHaveLength(1);
      await extensionService.postChangedExtension(false, mockExtensionProps.realPath);
      const postExtensions = await extensionService.getExtensions();
      expect(postExtensions).toHaveLength(1);
    });
  });

  describe('extension contributes', () => {
    it('should register toolbar actions via new toolbar action contribution point', () => {
      const toolbarRegistry: IToolbarRegistry = injector.get(IToolbarRegistry);
      (toolbarRegistry as NextToolbarRegistryImpl).init();
      const groups = toolbarRegistry.getActionGroups('default');
      expect(groups!.length).toBe(1);
      expect(toolbarRegistry.getToolbarActions({ location: 'default', group: groups![0].id })!.actions!.length).toBe(1);
    });

    it('should register shadow command via command contribution point', () => {
      const commandRegistry: CommandRegistryImpl = injector.get(CommandRegistry);
      expect(commandRegistry.getCommand('HelloKaitian')).toBeDefined();
    });

    it('should register menus in editor/title and editor/context position', (done) => {
      const newMenuRegistry: MenuRegistryImpl = injector.get(IMenuRegistry);
      const contextMenu = newMenuRegistry.getMenuItems('editor/context');
      expect(contextMenu.length).toBe(1);
      expect((contextMenu[0] as IMenuItem).command!).toBe('HelloKaitian');
      const actionMenu = newMenuRegistry.getMenuItems('editor/title');
      expect(actionMenu.length).toBe(1);
      expect((actionMenu).findIndex((item) => (item as IMenuItem).command === 'HelloKaitian')).toBeGreaterThan(-1);
      done();
    });

    it('should register viewContainer in activityBar', (done) => {
      const layoutService: LayoutService = injector.get(IMainLayoutService);
      const handler = layoutService.getTabbarHandler('package-explorer');
      expect(handler).toBeDefined();
      const holdHandler = layoutService.getTabbarHandler('hold-container');
      expect(holdHandler).toBeUndefined();
      done();
    });

    it('should register extension configuration', (done) => {
      const preferenceSettingsService: PreferenceSettingsService = injector.get(IPreferenceSettingsService);
      const preferences = preferenceSettingsService.getSections('extension', PreferenceScope.Default);
      expect(preferences.length).toBe(1);
      expect(preferences[0].title).toBe('Mock Extension Config');
      done();
    });

    it('should register browserView', (done) => {
      const layoutService: LayoutService = injector.get(IMainLayoutService);
      const tabbar = layoutService.getTabbarHandler('test.kaitian-extension:KaitianViewContribute');
      expect(tabbar).toBeDefined();
      expect(tabbar?.containerId).toBe('test.kaitian-extension:KaitianViewContribute');
      done();
    });

    it('should register browserView', (done) => {
      const layoutService: IMainLayoutService = injector.get(IMainLayoutService);
      const tabbar = layoutService.getTabbarHandler('test.kaitian-extension:KaitianViewContribute');
      expect(tabbar).toBeDefined();
      done();
    });

    it('should register keybinding for HelloKaitian command', (done) => {
      const keyBinding: KeybindingRegistryImpl = injector.get(KeybindingRegistry);
      const commandKeyBindings = keyBinding.getKeybindingsForCommand('HelloKaitian');
      expect(commandKeyBindings.length).toBe(1);
      expect(typeof commandKeyBindings[0].keybinding).toBe('string');
      done();
    });

    it('should register mock color', async (done) => {
      const themeService: WorkbenchThemeService = injector.get(IThemeService);
      const colorRegister = getColorRegistry();
      const theme = await themeService.getCurrentTheme();
      const color = colorRegister.resolveDefaultColor('mock.superstatus.error', theme);
      expect(color).toBeDefined();
      expect(color?.toString()).toBe('#ff004f');
      done();
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
