import { IWorkspaceService } from '@ali/ide-workspace';
import type { Position } from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Disposable, IFileServiceClient } from '@ali/ide-core-browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DebugBreakpointWidget } from '@ali/ide-debug/lib/browser/editor';
import { DebugEditor, IDebugSessionManager } from '@ali/ide-debug';
import { IContextKeyService } from '@ali/ide-core-browser';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';

describe('Debug Breakpoint Widget', () => {
  const mockInjector = createBrowserInjector([]);
  let debugBreakpointWidget: DebugBreakpointWidget;

  const mockDebugEditor = {
    onDidLayoutChange: jest.fn(() => Disposable.create(() => {})),
    getLayoutInfo: jest.fn(() => ({width: 100, height: 100})),
    changeViewZones: jest.fn(() => Disposable.create(() => {})),
  };

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: DebugEditor,
      useValue: mockDebugEditor,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: {
        createKey: jest.fn(),
      },
    });
    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: {},
    });
    debugBreakpointWidget = mockInjector.get(DebugBreakpointWidget);
  });

  it('should have enough API', () => {
    expect(debugBreakpointWidget.position).toBeUndefined();
    expect(debugBreakpointWidget.values).toBeUndefined();
    expect(typeof debugBreakpointWidget.show).toBe('function');
    expect(typeof debugBreakpointWidget.hide).toBe('function');
  });

  it('show method should be work', () => {
    const position = {lineNumber: 1, column: 2} as Position;
    debugBreakpointWidget.show(position);
    expect(mockDebugEditor.onDidLayoutChange).toBeCalledTimes(1);
    expect(mockDebugEditor.getLayoutInfo).toBeCalledTimes(1);
    expect(mockDebugEditor.changeViewZones).toBeCalledTimes(1);

    expect(debugBreakpointWidget.position).toBe(position);
  });

  it('hide method should be work', (done) => {
    debugBreakpointWidget.hide();
    done();
  });
});
