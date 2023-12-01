import { act } from 'react-dom/test-utils';

import { Disposable, IContextKeyService, IFileServiceClient } from '@opensumi/ide-core-browser';
import { Emitter } from '@opensumi/ide-core-common';
import { DebugEditor, IDebugSessionManager } from '@opensumi/ide-debug';
import { DebugBreakpointWidget } from '@opensumi/ide-debug/lib/browser/editor';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import type { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

describe('Debug Breakpoint Widget', () => {
  const mockInjector = createBrowserInjector([]);
  let debugBreakpointWidget: DebugBreakpointWidget;

  const mockDebugEditor = {
    focus: jest.fn(),
    dispose: () => {},
    onDidLayoutChange: jest.fn(() => Disposable.create(() => {})),
    getLayoutInfo: jest.fn(() => ({ width: 100, height: 100 })),
    changeViewZones: jest.fn(() => Disposable.create(() => {})),
    getOption: () => 10,
    createDecorationsCollection() {
      return {
        onDidChange: new Emitter().event,
        clear: () => {},
        length: 0,
        set: () => {},
        getRange: () => null,
        getRanges: () => [],
        has: () => true,
      };
    },
    monacoEditor: {
      setModel: jest.fn(),
      getModel: jest.fn(),
      setValue: jest.fn(),
      dispose: () => {},
      onDidBlurEditorWidget: new Emitter().event,
      onDidFocusEditorWidget: new Emitter().event,
      onDidChangeModelContent: new Emitter().event,
    },
    getModel: jest.fn(() => ({
      getLanguageId: () => 'javascript',
    })),
  };

  beforeAll(() => {
    mockInjector.overrideProviders({
      token: DebugEditor,
      useValue: mockDebugEditor,
    });
    mockInjector.overrideProviders({
      token: IWorkspaceService,
      useValue: {
        roots: [],
        onWorkspaceChanged: new Emitter().event,
      },
    });
    mockInjector.overrideProviders({
      token: EditorCollectionService,
      useValue: mockService({
        listEditors: () => [mockDebugEditor],
        createCodeEditor: jest.fn(() => mockDebugEditor),
      }),
    });
    mockInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useValue: {
        createModelReference: (uri) => ({
          instance: {
            uri,
            getMonacoModel: () => ({
              getValue: jest.fn(() => ''),
              updateOptions: jest.fn(),
            }),
          },
          dispose: jest.fn(),
        }),
      },
    });
    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: {},
    });
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: {
        createKey: jest.fn(),
        getContextValue: jest.fn(),
        onDidChangeContext: new Emitter().event,
      },
    });
    mockInjector.overrideProviders({
      token: IFileServiceClient,
      useValue: {
        onFilesChanged: jest.fn(),
      },
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
    const position = { lineNumber: 1, column: 2 } as Position;
    act(() => {
      debugBreakpointWidget.show(position);
    });
    expect(mockDebugEditor.onDidLayoutChange).toBeCalledTimes(1);
    expect(mockDebugEditor.getLayoutInfo).toBeCalledTimes(1);
    expect(mockDebugEditor.changeViewZones).toBeCalledTimes(1);

    expect(debugBreakpointWidget.position).toBe(position);
  });

  it('hide method should be work', (done) => {
    act(() => {
      debugBreakpointWidget.hide();
    });
    done();
  });
});
