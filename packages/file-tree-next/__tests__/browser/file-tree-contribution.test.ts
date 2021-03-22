import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { OutlineModule } from '@ali/ide-outline/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { FileTreeContribution } from '@ali/ide-file-tree-next/lib/browser/file-tree-contribution';
import { IFileTreeAPI, IFileTreeService } from '@ali/ide-file-tree-next';
import { IWorkspaceService } from '@ali/ide-workspace';
import { Emitter, URI } from '@ali/ide-core-node';
import { ExplorerContainerId } from '@ali/ide-explorer/lib/browser/explorer-contribution';
import { IDecorationsService } from '@ali/ide-decoration';
import { MockWorkbenchEditorService } from '@ali/ide-editor/lib/common/mocks/workbench-editor.service';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IDialogService, IMessageService, IWindowDialogService } from '@ali/ide-overlay';
import { IClipboardService, IContextKeyService, PreferenceService } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';

describe('FileTreeContribution', () => {
  let mockInjector: MockInjector;
  const tabbarHandlerMap = new Map();

  const mockMainLayoutService = {
    collectViewComponent: jest.fn(),
    getTabbarHandler: (name: string) => {
      if (tabbarHandlerMap.has(name)) {
        return tabbarHandlerMap.get(name);
      }
      const handler = {
        updateViewTitle:  jest.fn(),
        onActivate: jest.fn(),
      };
      tabbarHandlerMap.set(name, handler);
      return handler;
    },
  };
  const mockFileTreeService = {
    init: jest.fn(),
    reWatch: jest.fn(),
    getNodeByPathOrUri: () => ({
      filestat: {
        isSymbolicLink: true,
        isDirectory: false,
        lastModification: new Date().getTime(),
        uri: URI.file('userhome').resolve('test').toString(),
      },
    }),
  };
  const mockDecorationsService = {
    registerDecorationsProvider: jest.fn(),
  };
  const onWorkspaceLocationChangedEmitter = new Emitter();
  const mockWorkspaceService = {
    workspace: {
      isSymbolicLink: false,
      isDirectory: true,
      lastModification: new Date().getTime(),
      uri: URI.file('userhome').toString(),
    },
    onWorkspaceLocationChanged: onWorkspaceLocationChangedEmitter.event,
  };

  beforeEach(() => {
    mockInjector = createBrowserInjector([
      OutlineModule,
    ]);

    mockInjector.overrideProviders(
      {
        token: IMainLayoutService,
        useValue: mockMainLayoutService,
      },
      {
        token: IFileTreeService,
        useValue: mockFileTreeService,
      },
      {
        token: IWorkspaceService,
        useValue: mockWorkspaceService,
      },
      {
        token: IDecorationsService,
        useValue: mockDecorationsService,
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkbenchEditorService,
      },
      {
        token: IWindowDialogService,
        useValue: {},
      },
      {
        token: IFileTreeAPI,
        useValue: {},
      },
      {
        token: IMessageService,
        useValue: {},
      },
      {
        token: IClipboardService,
        useValue: {},
      },
      {
        token: IDialogService,
        useValue: {},
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: PreferenceService,
        useValue: {},
      },
    );

  });

  afterAll(() => {
    mockInjector.disposeAll();
  });

  describe('01 #contribution should be work', () => {
    it('should onStart be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      await contribution.onStart();
      expect(mockFileTreeService.init).toBeCalledTimes(1);
      expect(mockMainLayoutService.collectViewComponent).toBeCalledTimes(1);
      await onWorkspaceLocationChangedEmitter.fireAndAwait(undefined);
      const handler = tabbarHandlerMap.get(ExplorerContainerId);
      expect(handler.updateViewTitle).toBeCalledTimes(1);
    });

    it('should onDidStart be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      await contribution.onDidStart();
      expect(mockDecorationsService.registerDecorationsProvider).toBeCalledTimes(1);
    });

    it('should onDidRender be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      contribution.onDidRender();
      const handler = tabbarHandlerMap.get(ExplorerContainerId);
      expect(handler.onActivate).toBeCalledTimes(1);
    });

    it('should getWorkspaceTitle be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      const title = contribution.getWorkspaceTitle();
      expect(title).toBe('userhome');
    });

    it('should onReconnect be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      contribution.onReconnect();
      expect(mockFileTreeService.reWatch).toBeCalledTimes(1);
    });

    it('should registerCommands be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      const register = jest.fn();
      contribution.registerCommands({ registerCommand: register } as any);
      expect(register).toBeCalledTimes(30);
    });

    it('should registerMenus be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      const register = jest.fn();
      contribution.registerMenus({ registerMenuItem: register } as any);
      expect(register).toBeCalledTimes(14);
    });

    it('should registerKeybindings be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      const register = jest.fn();
      contribution.registerKeybindings({ registerKeybinding: register } as any);
      expect(register).toBeCalledTimes(12);
    });

    it('should registerToolbarItems be work', async () => {
      const contribution = mockInjector.get(FileTreeContribution);
      const register = jest.fn();
      contribution.registerToolbarItems({ registerItem: register } as any);
      expect(register).toBeCalledTimes(5);
    });
  });

});
