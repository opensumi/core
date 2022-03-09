import {
  Disposable,
  QuickPickService,
  IContextKeyService,
  PreferenceService,
  URI,
  FileStat,
  StorageProvider,
} from '@opensumi/ide-core-browser';
import { IDebugServer } from '@opensumi/ide-debug';
import { DebugConfigurationManager, DebugPreferences } from '@opensumi/ide-debug/lib/browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';

describe('Debug Configuration Manager', () => {
  const mockInjector = createBrowserInjector([]);
  let debugConfigurationManager: DebugConfigurationManager;
  const root = URI.file('home/test');
  const rootFileStat: FileStat = {
    uri: root.toString(),
    isDirectory: true,
    lastModification: new Date().getTime(),
  };

  const mockWorkspaceService = {
    roots: Promise.resolve([rootFileStat]),
    getWorkspaceRootUri: jest.fn(() => root),
  };

  const mockMonacoEditorModel = {
    getLineLastNonWhitespaceColumn: jest.fn(),
    getPositionAt: jest.fn(() => 1),
  };

  const mockMonacoEditor = {
    _commandService: {
      executeCommand: jest.fn(),
    },
    getModel: () => mockMonacoEditorModel,
    setPosition: jest.fn(),
    getValue: () =>
      JSON.stringify({
        configUri: root.resolve('.sumi/launch.json'),
        value: {
          version: '0.2.0',
          configurations: [
            {
              type: 'node',
              request: 'attach',
              name: 'Attach to BackEnd',
              port: 9999,
              restart: true,
            },
          ],
        },
      }),
    trigger: jest.fn(),
  };

  const mockWorkbenchEditorService = {
    open: jest.fn(() => ({
      group: {
        codeEditor: {
          monacoEditor: mockMonacoEditor,
        },
      },
    })),
  };

  const mockPreferenceService = {
    onPreferenceChanged: jest.fn(() => Disposable.create(() => {})),
    resolve: jest.fn(() => ({
      configUri: root.resolve('.sumi/launch.json'),
      value: {
        version: '0.2.0',
        configurations: [
          {
            type: 'node',
            request: 'attach',
            name: 'Attach to BackEnd',
            port: 9999,
            restart: true,
          },
        ],
      },
    })),
  };

  const mockDebugServer = {
    debugTypes: jest.fn(() => ['node']),
  };

  const mockFileServiceClient = {
    createFile: jest.fn(),
    setContent: jest.fn(),
  };

  const mockDebugStorage = {
    get: jest.fn((key) => {
      if (key === 'configurations') {
        return {
          current: {
            name: 'Attach to BackEnd',
            index: 0,
            workspaceFolderUri: root.toString(),
          },
        };
      }
    }),
    set: jest.fn(),
  };

  const mockDebugPreferences = {
    'preference.debug.allowBreakpointsEverywhere': true,
  };

  beforeAll(async (done) => {
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    });

    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });

    mockInjector.overrideProviders({
      token: PreferenceService,
      useValue: mockPreferenceService,
    });

    mockInjector.overrideProviders({
      token: WorkbenchEditorService,
      useValue: mockWorkbenchEditorService,
    });

    mockInjector.overrideProviders({
      token: IDebugServer,
      useValue: mockDebugServer,
    });

    mockInjector.overrideProviders({
      token: QuickPickService,
      useValue: {},
    });

    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: mockFileServiceClient,
    });

    mockInjector.overrideProviders({
      token: DebugPreferences,
      useValue: mockDebugPreferences,
    });

    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: () => mockDebugStorage,
    });

    debugConfigurationManager = mockInjector.get(DebugConfigurationManager);

    await debugConfigurationManager.whenReady;

    done();
  });

  afterAll(() => {});

  it('debugModelManager should be init success', () => {
    expect(mockPreferenceService.onPreferenceChanged).toBeCalledTimes(2);
  });

  it('should have enough API', () => {
    expect(typeof debugConfigurationManager.supported).toBe('object');
    expect(typeof debugConfigurationManager.find).toBe('function');
    expect(typeof debugConfigurationManager.openConfiguration).toBe('function');
    expect(typeof debugConfigurationManager.addConfiguration).toBe('function');
    expect(typeof debugConfigurationManager.load).toBe('function');
    expect(typeof debugConfigurationManager.save).toBe('function');
    expect(typeof debugConfigurationManager.canSetBreakpointsIn).toBe('function');
    expect(typeof debugConfigurationManager.addSupportBreakpoints).toBe('function');
    expect(typeof debugConfigurationManager.removeSupportBreakpoints).toBe('function');
    expect(typeof debugConfigurationManager.registerDebugger).toBe('function');
    expect(typeof debugConfigurationManager.registerDebugger).toBe('function');
    expect(typeof debugConfigurationManager.getDebuggers).toBe('function');
    expect(typeof debugConfigurationManager.getDebugger).toBe('function');
  });

  it('find method should be work', () => {
    const configuration = debugConfigurationManager.find('Attach to BackEnd', root.toString());
    expect(configuration).toBeDefined();
    expect(configuration!.workspaceFolderUri).toBe(root.toString());
  });

  it('getSupported method should be work', async (done) => {
    const support = await debugConfigurationManager.supported;
    expect(support).toBeDefined();
    expect(support.length).toBe(1);
    done();
  });

  it('openConfiguration method should be work', async (done) => {
    await debugConfigurationManager.openConfiguration();
    expect(mockWorkbenchEditorService.open).toBeCalledTimes(1);
    done();
  });

  it('addConfiguration method should be work', async (done) => {
    await debugConfigurationManager.addConfiguration();
    expect(mockMonacoEditorModel.getLineLastNonWhitespaceColumn).toBeCalledTimes(2);
    expect(mockMonacoEditor.setPosition).toBeCalledTimes(1);
    expect(mockMonacoEditor.trigger).toBeCalledTimes(2);
    done();
  });

  it('load method should be work', async (done) => {
    await debugConfigurationManager.load();
    expect(mockDebugStorage.get).toBeCalledTimes(1);
    done();
  });

  it('save method should be work', async (done) => {
    await debugConfigurationManager.save();
    expect(mockDebugStorage.set).toBeCalledTimes(1);
    done();
  });

  it('canSetBreakpointsIn method should be work', () => {
    // jsonc
    let mockGetLanguageIdentifier = jest.fn(() => ({ language: 'jsonc' }));
    let expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeFalsy();
    // log
    mockGetLanguageIdentifier = jest.fn(() => ({ language: 'log' }));
    expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeFalsy();
    // undefined model
    expected = debugConfigurationManager.canSetBreakpointsIn(null as any);
    expect(expected).toBeFalsy();
    // if allowBreakpointsEverywhere = true
    mockGetLanguageIdentifier = jest.fn(() => ({ language: 'c' }));
    expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeTruthy();
    // if allowBreakpointsEverywhere = false
    mockDebugPreferences['preference.debug.allowBreakpointsEverywhere'] = false;
    mockGetLanguageIdentifier = jest.fn(() => ({ language: 'c' }));
    expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeFalsy();
    // while debug server support node language
    debugConfigurationManager.addSupportBreakpoints('node');
    mockGetLanguageIdentifier = jest.fn(() => ({ language: 'node' }));
    expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeTruthy();
  });

  it('addSupportBreakpoints method should be work', () => {
    const mockGetLanguageIdentifier = jest.fn(() => ({ language: 'abc' }));
    debugConfigurationManager.addSupportBreakpoints('abc');
    const expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeTruthy();
  });

  it('removeSupportBreakpoints method should be work', () => {
    const mockGetLanguageIdentifier = jest.fn(() => ({ language: 'abc' }));
    debugConfigurationManager.removeSupportBreakpoints('abc');
    const expected = debugConfigurationManager.canSetBreakpointsIn({
      getLanguageIdentifier: mockGetLanguageIdentifier,
    } as any);
    expect(expected).toBeFalsy();
  });

  it('registerDebugger/getDebugger/getDebuggers method should be work', () => {
    const debugContribution = {
      type: 'node',
    };
    debugConfigurationManager.registerDebugger(debugContribution);

    const contribute = debugConfigurationManager.getDebugger('node');
    expect(contribute).toEqual(debugContribution);

    const contributes = debugConfigurationManager.getDebuggers();
    expect(contributes.length).toBe(1);
  });
});
