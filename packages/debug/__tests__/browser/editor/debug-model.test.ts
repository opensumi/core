import { Injector } from '@opensumi/di';
import { Disposable, IContextKeyService, URI } from '@opensumi/ide-core-browser';
import { AbstractMenuService, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { IDebugModel, IDebugSessionManager } from '@opensumi/ide-debug';
import { BreakpointManager, DebugBreakpoint } from '@opensumi/ide-debug/lib/browser/breakpoint';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { EditorDocumentModelServiceImpl } from '@opensumi/ide-editor/lib/browser/doc-model/editor-document-model-service';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import * as monaco from '@opensumi/ide-monaco';
import { createMockedMonaco } from '@opensumi/ide-monaco/__mocks__/monaco';
import { monacoBrowser } from '@opensumi/ide-monaco/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceService } from '@opensumi/ide-workspace/lib/browser/workspace-service';

import { DebugBreakpointWidget, DebugHoverWidget, DebugModel } from '../../../src/browser/editor';

describe('Debug Model', () => {
  const mockInjector = createBrowserInjector([]);
  let childInjector: Injector;
  let debugModel: IDebugModel;
  const testFileUri = URI.file('editor.js');
  let mockCtxMenuRenderer: ICtxMenuRenderer;
  let mockEditor: any;
  let mockBreakpointManager: any;
  let mockBreakpointWidget: any;
  let mockDebugHoverWidget: any;
  let mockMenuService: any;

  beforeEach(() => {
    (global as any).monaco = createMockedMonaco() as any;

    mockCtxMenuRenderer = {
      show: jest.fn(),
    } as any;

    mockEditor = {
      getModel: jest.fn(() => ({
        uri: testFileUri,
        getDecorationRange: () => ({
          startLineNumber: 1,
          startColumn: 0,
          endLineNumber: 1,
          endColumn: 10,
        }),
        getLineFirstNonWhitespaceColumn: () => 1,
        getLineLastNonWhitespaceColumn: () => 10,
        getLineCount: () => 10,
        onDidLayoutChange: jest.fn(() => Disposable.create(() => {})),
        onDidChangeContent: jest.fn(() => Disposable.create(() => {})),
      })),
      onDidChangeModel: () => Disposable.create(() => {}),
      onDidChangeModelContent: () => Disposable.create(() => {}),
      getLineDecorations: jest.fn((line: number) => []),
      onKeyDown: jest.fn(() => Disposable.create(() => {})),
      getPosition: jest.fn(() => ({ lineNumber: 2, column: 1 })),
      deltaDecorations: jest.fn(() => []),
      focus: jest.fn(),
      dispose: () => {},
    };

    mockBreakpointManager = {
      whenReady: Promise.resolve(),
      onDidChange: jest.fn(() => Disposable.create(() => {})),
      delBreakpoint: jest.fn(() => Disposable.create(() => {})),
      addBreakpoint: jest.fn(() => Disposable.create(() => {})),
      updateBreakpoint: jest.fn(() => Disposable.create(() => {})),
      getBreakpoint: jest.fn(() => DebugBreakpoint.create(testFileUri, { line: 2 })),
      getBreakpoints: jest.fn(() => [DebugBreakpoint.create(testFileUri, { line: 2 })]),
    };

    mockBreakpointWidget = {
      dispose: () => {},
      show: jest.fn(),
      hide: jest.fn(),
      position: { lineNumber: 1, column: 2 },
      values: {
        condition: '',
        hitCondition: '',
        logMessage: '',
      },
    };

    mockDebugHoverWidget = {
      getDomNode: jest.fn(),
      hide: jest.fn(),
      show: jest.fn(),
    };

    mockMenuService = {
      createMenu: jest.fn(() => ({
        getMenuNodes: () => [],
      })),
    };

    mockInjector.overrideProviders({
      token: ICtxMenuRenderer,
      useValue: mockCtxMenuRenderer,
    });

    mockInjector.overrideProviders({
      token: BreakpointManager,
      useValue: mockBreakpointManager,
    });

    mockInjector.overrideProviders({
      token: IDebugSessionManager,
      useValue: mockBreakpointManager,
    });

    mockInjector.overrideProviders({
      token: AbstractMenuService,
      useValue: mockMenuService,
    });

    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: {
        getContextKeyValue: jest.fn(),
      },
    });

    childInjector = DebugModel.createContainer(mockInjector, mockEditor as any);

    childInjector.overrideProviders({
      token: DebugHoverWidget,
      useValue: mockDebugHoverWidget,
    });

    childInjector.overrideProviders({
      token: DebugBreakpointWidget,
      useValue: mockBreakpointWidget,
    });

    childInjector.overrideProviders({
      token: IWorkspaceService,
      useClass: WorkspaceService,
    });

    childInjector.overrideProviders({
      token: IEditorDocumentModelService,
      useClass: EditorDocumentModelServiceImpl,
    });

    childInjector.overrideProviders({
      token: IFileServiceClient,
      useClass: FileServiceClient,
    });

    debugModel = childInjector.get(IDebugModel);
  });

  it('debugModel should be init success', () => {
    expect(mockEditor.onKeyDown).toHaveBeenCalledTimes(1);
    expect(mockEditor.getModel).toHaveBeenCalledTimes(4);
    expect(mockBreakpointManager.onDidChange).toHaveBeenCalledTimes(1);
  });

  it('should have enough API', () => {
    expect(typeof DebugModel.createContainer).toBe('function');
    expect(typeof DebugModel.createModel).toBe('function');

    expect(debugModel.uri).toBeDefined();
    expect(debugModel.position).toBeDefined();
    expect(debugModel.breakpoint).toBeDefined();

    expect(typeof debugModel.init).toBe('function');
    expect(typeof debugModel.dispose).toBe('function');
    expect(typeof debugModel.focusStackFrame).toBe('function');
    expect(typeof debugModel.render).toBe('function');
    expect(typeof debugModel.renderBreakpoints).toBe('function');
    expect(typeof debugModel.toggleBreakpoint).toBe('function');
    expect(typeof debugModel.openBreakpointView).toBe('function');
    expect(typeof debugModel.closeBreakpointView).toBe('function');
    expect(typeof debugModel.acceptBreakpoint).toBe('function');
  });

  it('focusStackFrame should be work', () => {
    mockEditor.deltaDecorations.mockClear();
    debugModel.focusStackFrame();
    expect(mockEditor.deltaDecorations).toHaveBeenCalledTimes(0);
  });

  it('renderBreakpoints should be work', async () => {
    mockEditor.deltaDecorations.mockClear();
    await debugModel.renderBreakpoints();
    expect(mockEditor.deltaDecorations).toHaveBeenCalledTimes(3);
  });

  it('render should be work', async () => {
    mockEditor.deltaDecorations.mockClear();
    await debugModel.render();
    expect(mockEditor.deltaDecorations).toHaveBeenCalledTimes(3);
  });

  it('toggleBreakpoint should be work', () => {
    mockBreakpointManager.getBreakpoints.mockClear();
    debugModel.toggleBreakpoint({ lineNumber: 1, column: 2 } as monaco.Position);
    expect(mockBreakpointManager.getBreakpoints).toHaveBeenCalledTimes(1);
    expect(mockBreakpointManager.delBreakpoint).toHaveBeenCalledTimes(1);
    mockBreakpointManager.getBreakpoints.mockReturnValueOnce([] as any);
    debugModel.toggleBreakpoint({ lineNumber: 1, column: 2 } as monaco.Position);
    expect(mockBreakpointManager.addBreakpoint).toHaveBeenCalledTimes(1);
  });

  it('openBreakpointView should be work', () => {
    debugModel.openBreakpointView({ lineNumber: 1, column: 1 } as monaco.Position);
    expect(mockBreakpointWidget.show).toHaveBeenCalledTimes(1);
  });

  it('closeBreakpointView should be work', () => {
    debugModel.closeBreakpointView();
    expect(mockBreakpointWidget.hide).toHaveBeenCalledTimes(1);
  });

  it('acceptBreakpoint should be work', () => {
    debugModel.acceptBreakpoint();
    expect(mockBreakpointManager.updateBreakpoint).toHaveBeenCalledTimes(1);
    expect(mockBreakpointWidget.hide).toHaveBeenCalledTimes(1);
    mockBreakpointManager.getBreakpoint.mockReturnValueOnce(null as any);
    debugModel.acceptBreakpoint();
    expect(mockBreakpointManager.addBreakpoint).toHaveBeenCalledTimes(1);
    expect(mockBreakpointWidget.hide).toHaveBeenCalledTimes(2);
  });

  it('onContextMenu should be work', () => {
    const mockEvent = {
      target: {
        type: monacoBrowser.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        browserEvent: {},
      },
    };
    debugModel.onContextMenu(mockEvent as monaco.editor.IEditorMouseEvent);
    expect(mockCtxMenuRenderer.show).toHaveBeenCalledTimes(1);
  });

  it('onMouseDown should be work', () => {
    const mockEvent = {
      target: {
        type: monacoBrowser.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        browserEvent: {},
      },
    };
    debugModel.onMouseDown(mockEvent as monaco.editor.IEditorMouseEvent);
    expect(mockEditor.focus).toHaveBeenCalledTimes(1);
  });

  it('onMouseMove should be work', () => {
    debugModel.onMouseMove({
      target: {
        type: monacoBrowser.editor.MouseTargetType.CONTENT_TEXT,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        altKey: false,
      },
    } as monaco.editor.IEditorMouseEvent);
    expect(mockDebugHoverWidget.show).toHaveBeenCalledTimes(1);
    debugModel.onMouseMove({
      target: {
        type: monacoBrowser.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        altKey: false,
      },
    } as monaco.editor.IEditorMouseEvent);
    expect(mockDebugHoverWidget.hide).toHaveBeenCalledTimes(1);
  });

  it('onMouseLeave should be work', () => {
    const mockEvent = {
      target: {
        type: monacoBrowser.editor.MouseTargetType.GUTTER_GLYPH_MARGIN,
        position: {
          lineNumber: 1,
        },
      },
      event: {
        posx: 2,
      },
    };
    const getBoundingClientRect = jest.fn(() => ({
      left: 10,
    }));
    mockDebugHoverWidget.getDomNode.mockReturnValueOnce({
      getBoundingClientRect,
    });
    debugModel.onMouseLeave(mockEvent as monaco.editor.IEditorMouseEvent);
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(mockDebugHoverWidget.hide).toHaveBeenCalledTimes(1);
  });
});
