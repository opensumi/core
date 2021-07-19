import { IWorkspaceService } from '@ali/ide-workspace';
import { Disposable, IContextKeyService, IFileServiceClient, MonacoOverrideServiceRegistry } from '@ali/ide-core-browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DebugEditorContribution } from '@ali/ide-debug/lib/browser/editor/debug-editor-contribution';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { DebugModelFactory, IDebugServer } from '@ali/ide-debug';
import { QuickPickService } from '@ali/ide-core-browser';
import { DebugPreferences } from '@ali/ide-debug/lib/browser';
import { IDebugSessionManager } from './../../../src/common/debug-session';

describe('Editor Hover Contribution', () => {
  const mockInjector = createBrowserInjector([]);
  let contribution: DebugEditorContribution;

  const mockContextKeyService = {
    onDidChangeContext: jest.fn(() => Disposable.create(() => {})),
  };
  beforeAll(() => {
    mockInjector.overrideProviders(
      {
        token: IContextKeyService,
        useValue: mockContextKeyService,
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: DebugModelFactory,
        useValue: {},
      },
      {
        token: IFileServiceClient,
        useValue: {},
      },
      {
        token: IWorkspaceService,
        useValue: {},
      },
      {
        token: IDebugServer,
        useValue: {},
      },
      {
        token: QuickPickService,
        useValue: {},
      },
      {
        token: DebugPreferences,
        useValue: {},
      },
      {
        token: IDebugSessionManager,
        useValue: {
          onDidChangeActiveDebugSession: jest.fn(() => Disposable.create(() => {})),
        },
      },
      {
        token: MonacoOverrideServiceRegistry,
        useValue: {},
      },
    );

    contribution = mockInjector.get(DebugEditorContribution);
  });

  it('should have enough API', () => {
    expect(typeof contribution.contribute).toBe('function');
    expect(typeof contribution.toggleHoverEnabled).toBe('function');
  });

  it('contribute method should be work', () => {
    const mockEditor = {
      monacoEditor: {
        updateOptions: jest.fn(),
        onKeyDown: jest.fn(() => Disposable.create(() => {})),
        onKeyUp: jest.fn(() => Disposable.create(() => {})),
        onDidChangeModelContent: jest.fn(() => Disposable.create(() => {})),
        onDidChangeModel: jest.fn(() => Disposable.create(() => {})),
        removeDecorations: jest.fn(() => Disposable.create(() => {})),
        getVisibleRanges: jest.fn(() => Disposable.create(() => {})),
        getModel: jest.fn(() => Disposable.create(() => {})),
        setDecorations: jest.fn(() => Disposable.create(() => {})),
      },
    };
    contribution.contribute(mockEditor as any);
    expect(mockContextKeyService.onDidChangeContext).toBeCalledTimes(1);
  });
});
