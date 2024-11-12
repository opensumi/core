import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, EventBusImpl, IEventBus, StorageProvider, URI } from '@opensumi/ide-core-common';
import { DEFAULT_CONFIGURATION_NAME_SEPARATOR, IDebugSessionManager } from '@opensumi/ide-debug';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser/debug-configuration-manager';
import { DebugConfigurationService } from '@opensumi/ide-debug/lib/browser/view/configuration/debug-configuration.service';
import { DebugConsoleService } from '@opensumi/ide-debug/lib/browser/view/console/debug-console.service';
import { DebugViewModel } from '@opensumi/ide-debug/lib/browser/view/debug-view-model';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IWorkspaceService } from '@opensumi/ide-workspace';

describe('Debug Configuration Service', () => {
  const mockInjector = createBrowserInjector(
    [],
    new MockInjector([
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
    ]),
  );
  let debugConfigurationService: DebugConfigurationService;

  const mockDebugSessionManager = {
    onDidDestroyDebugSession: jest.fn(() => Disposable.create(() => {})),
    onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
    start: jest.fn(),
  };

  const mockDebugViewModel = {
    onDidChange: jest.fn(),
  };

  const mockWorkspaceService = {
    roots: [],
    onWorkspaceChanged: jest.fn(),
    isMultiRootWorkspaceEnabled: true,
    tryGetRoots: () => [],
  };

  const mockDebugConfigurationManager = {
    all: [],
    find: jest.fn(() => ({
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    })),
    onDidChange: jest.fn(),
    current: {
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    },
    addConfiguration: jest.fn(),
    openConfiguration: jest.fn(),
    getDynamicConfigurationsSupportTypes: jest.fn(() => []),
  };

  const mockPreferenceService = {
    onPreferenceChanged: jest.fn(),
    get: jest.fn(() => true),
    getValid: jest.fn(() => true),
  };

  const mockDebugConsoleService = {
    activate: jest.fn(),
  };

  const mockStorage = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockStorageProvider = () => mockStorage;

  beforeAll(async () => {
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockDebugSessionManager,
    });
    mockInjector.addProviders({
      token: DebugConfigurationManager,
      useValue: mockDebugConfigurationManager,
    });
    mockInjector.overrideProviders({
      token: DebugConsoleService,
      useValue: mockDebugConsoleService,
    });
    mockInjector.overrideProviders({
      token: StorageProvider,
      useValue: mockStorageProvider,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: mockWorkspaceService,
    });
    mockInjector.overrideProviders({
      token: DebugViewModel,
      useValue: mockDebugViewModel,
    });
    mockInjector.overrideProviders({
      token: PreferenceService,
      useValue: mockPreferenceService,
    });
    mockInjector.overrideProviders({
      token: DebugConfigurationService,
      useClass: DebugConfigurationService,
    });
    debugConfigurationService = mockInjector.get(DebugConfigurationService);
    await debugConfigurationService.whenReady;
  });

  it('should have enough API', () => {
    expect(typeof debugConfigurationService.init).toBe('function');
    expect(debugConfigurationService.currentValue.get()).toBe(
      `test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`,
    );
    expect(debugConfigurationService.float.get()).toBeTruthy();
    expect(debugConfigurationService.configurationOptions.get()).toEqual(mockDebugConfigurationManager.all);
    expect(typeof debugConfigurationService.updateCurrentValue).toBe('function');
    expect(typeof debugConfigurationService.updateConfigurationOptions).toBe('function');
    expect(typeof debugConfigurationService.start).toBe('function');
    expect(typeof debugConfigurationService.openConfiguration).toBe('function');
    expect(typeof debugConfigurationService.openDebugConsole).toBe('function');
    expect(typeof debugConfigurationService.addConfiguration).toBe('function');
    expect(typeof debugConfigurationService.updateConfiguration).toBe('function');
    expect(typeof debugConfigurationService.toValue).toBe('function');
    expect(typeof debugConfigurationService.toName).toBe('function');
  });

  it('should init success', () => {
    expect(mockDebugConfigurationManager.onDidChange).toHaveBeenCalledTimes(1);
    expect(mockPreferenceService.onPreferenceChanged).toHaveBeenCalledTimes(1);
    expect(mockPreferenceService.get).toHaveBeenCalledTimes(1);
  });

  it('updateCurrentValue method should be work', () => {
    const value = 'test';
    debugConfigurationService.updateCurrentValue(value);
    expect(debugConfigurationService.currentValue.get()).toBe(value);
  });

  it('updateConfigurationOptions method should be work', () => {
    debugConfigurationService.updateConfigurationOptions();
    expect(debugConfigurationService.currentValue.get()).toBe(
      `test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`,
    );
  });

  it('start method should be work', () => {
    debugConfigurationService.start();
    expect(mockDebugSessionManager.start).toHaveBeenCalledTimes(1);
    mockDebugConfigurationManager.current = undefined as any;
    debugConfigurationService.start();
    expect(mockDebugConfigurationManager.addConfiguration).toHaveBeenCalledTimes(1);
    mockDebugConfigurationManager.current = {
      configuration: {
        name: 'test',
      },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 0,
    };
  });

  it('openConfiguration method should be work', () => {
    debugConfigurationService.openConfiguration();
    expect(mockDebugConfigurationManager.openConfiguration).toHaveBeenCalledTimes(1);
  });

  it('openDebugConsole method should be work', () => {
    debugConfigurationService.openDebugConsole();
    expect(mockDebugConsoleService.activate).toHaveBeenCalledTimes(1);
  });

  it('addConfiguration method should be work', () => {
    debugConfigurationService.addConfiguration();
    expect(mockDebugConfigurationManager.addConfiguration).toHaveBeenCalledTimes(2);
  });

  it('toValue method should be work', () => {
    let value = debugConfigurationService.toValue({
      configuration: { name: 'test' },
      workspaceFolderUri: URI.file('home/workspace').toString(),
      index: 1,
    } as any);
    expect(value).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__1`);
    value = debugConfigurationService.toValue({
      configuration: { name: 'test' },
      workspaceFolderUri: URI.file('home/workspace').toString(),
    } as any);
    expect(mockDebugConfigurationManager.find).toHaveBeenCalledTimes(1);
    expect(value).toBe(`test${DEFAULT_CONFIGURATION_NAME_SEPARATOR}file:///home/workspace__INDEX__0`);
  });

  it('toName method should be work', () => {
    let value = debugConfigurationService.toName({
      configuration: { name: 'test' },
      workspaceFolderUri: URI.file('home/workspace').toString(),
    } as any);
    expect(value).toBe('test (workspace)');
    value = debugConfigurationService.toName({ configuration: { name: 'test' } } as any);
    expect(value).toBe('test');
  });
});
