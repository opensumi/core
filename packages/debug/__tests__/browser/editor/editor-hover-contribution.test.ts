import { IWorkspaceService } from '@ali/ide-workspace';
import { Disposable, IContextKeyService, IFileServiceClient } from '@ali/ide-core-browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { EditorHoverContribution } from '@ali/ide-debug/lib/browser/editor/editor-hover-contribution';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { DebugModelFactory, IDebugServer } from '@ali/ide-debug';
import { QuickPickService } from '@ali/ide-core-browser';
import { DebugPreferences } from '@ali/ide-debug/lib/browser';

describe('Editor Hover Contribution', () => {
  const mockInjector = createBrowserInjector([]);
  let contribution: EditorHoverContribution;

  const mockContextKeyService = {
    onDidChangeContext: jest.fn(() => Disposable.create(() => {})),
    match: jest.fn(),
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
    );

    contribution = mockInjector.get(EditorHoverContribution);
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
      },
    };
    contribution.contribute(mockEditor as any);
    expect(mockContextKeyService.onDidChangeContext).toBeCalledTimes(1);
    expect(mockContextKeyService.match).toBeCalledTimes(1);
    expect(mockEditor.monacoEditor.updateOptions).toBeCalledTimes(1);
  });
});
