import { IContextKeyService, PreferenceService, QuickPickService } from '@opensumi/ide-core-browser';
import { AbstractContextMenuService, ICtxMenuRenderer } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable, Emitter, IEventBus, ILogger, ISelection, URI } from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import {
  DragOverPosition,
  EditorGroupChangeEvent,
  EditorGroupCloseEvent,
  EditorGroupSplitAction,
  EditorOpenType,
  EditorSelectionChangeEvent,
  IEditorDocumentModelService,
  IEditorFeatureRegistry,
  IEditorGroup,
  WorkbenchEditorService,
  getSplitActionFromDragDrop,
} from '@opensumi/ide-editor/lib/browser';
import { EditorFeatureRegistryImpl } from '@opensumi/ide-editor/lib/browser/feature';
import { FormattingSelector } from '@opensumi/ide-editor/lib/browser/format/formatter-selector';
import { EditorHistoryService } from '@opensumi/ide-editor/lib/browser/history';
import { EditorContextMenuController } from '@opensumi/ide-editor/lib/browser/menu/editor.context';
import { TabTitleMenuService } from '@opensumi/ide-editor/lib/browser/menu/title-context.menu';
import { EditorTopPaddingContribution } from '@opensumi/ide-editor/lib/browser/view/topPadding';
import { EditorExtensionsRegistry } from '@opensumi/ide-monaco/lib/browser/contrib/command';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { IMessageService } from '@opensumi/ide-overlay';
import { SyncDescriptor } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/descriptors';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

Error.stackTraceLimit = 100;
describe('editor status bar item test', () => {
  const injector = createBrowserInjector([]);

  beforeAll(() => {
    injector.mockService(ILogger);
    injector.mockService(IMessageService);
    injector.addProviders({
      token: IEditorFeatureRegistry,
      useClass: EditorFeatureRegistryImpl,
    });
  });

  it('editor feature test basic', () => {
    expect(getSplitActionFromDragDrop(DragOverPosition.BOTTOM)).toBe(EditorGroupSplitAction.Bottom);

    const service: EditorFeatureRegistryImpl = injector.get(IEditorFeatureRegistry);
    const contributionDisposer = new Disposable();
    const contribution = {
      contribute: jest.fn((editor: IEditor) => contributionDisposer),
    };
    const listener = jest.fn();
    service.onDidRegisterFeature(listener);

    const disposer = service.registerEditorFeatureContribution(contribution);

    expect(listener).toHaveBeenCalledWith(contribution);

    service.runContributions({
      onDispose: jest.fn(),
    } as any);

    expect(contribution.contribute).toHaveBeenCalledTimes(1);

    disposer.dispose();
  });

  it('top padding feature test', () => {
    const service: EditorFeatureRegistryImpl = injector.get(IEditorFeatureRegistry);
    service.registerEditorFeatureContribution(new EditorTopPaddingContribution());
    const accessor = {
      addZone: jest.fn(),
    };
    const _onDidChangeModel = new Emitter<void>();
    const editor = {
      monacoEditor: {
        onDidChangeModel: _onDidChangeModel.event,
        changeViewZones: jest.fn((fn) => {
          fn(accessor);
        }),
      },
      onDispose: jest.fn(),
    };
    service.runContributions(editor as any);
    _onDidChangeModel.fire();
    expect(editor.monacoEditor.changeViewZones).toHaveBeenCalled();
    expect(accessor.addZone).toHaveBeenCalled();
  });

  const config = {};
  injector.mockService(PreferenceService, {
    get: jest.fn((key) => config[key]),
    set: jest.fn((key, value) => {
      config[key] = value;
    }),
  });
  injector.mockService(IEditorDocumentModelService, {
    getModelReference: () => ({
      instance: {
        languageId: 'javascript',
      },
      dispose: jest.fn(),
    }),
    getModelDescription: () => ({
      languageId: 'javascript',
    }),
  });

  it('formatter select test', async () => {
    injector.mockService(QuickPickService, {
      show: (strings: any[]) => strings[0].value,
    });

    const selector: FormattingSelector = injector.get(FormattingSelector);

    await selector.selectFormatter(
      [
        {
          displayName: 'Test Formatter',
          extensionId: 'testFormatter' as any,
          provideDocumentFormattingEdits: jest.fn(),
        },
        {
          displayName: 'Test Formatter2',
          extensionId: 'testFormatter2',
          provideDocumentFormattingEdits: jest.fn(),
        },
      ],
      {
        uri: new URI('file:///test/test.js').codeUri,
      } as any,
      1,
      1,
    );

    expect(config['editor.preferredFormatter']['javascript']).toBe('testFormatter');
  });

  it('formatter selector test for single formatter', async () => {
    injector.mockService(QuickPickService, {
      show: (strings: any[]) => strings[0].value,
    });

    const selector: FormattingSelector = injector.get(FormattingSelector);
    await selector.pickFormatter(
      [
        {
          displayName: 'Test Single Formatter',
          extensionId: 'testSingleFormatter' as any,
          provideDocumentFormattingEdits: jest.fn(),
        },
      ],
      {
        uri: new URI('file:///test/test2.js').codeUri,
      } as any,
    );

    expect(config['editor.preferredFormatter']['javascript']).toBe('testSingleFormatter');
  });

  afterAll(async () => {
    await injector.disposeAll();
  });
});

describe('editor history test', () => {
  const injector = createBrowserInjector([]);

  let selection: ISelection | undefined;
  let currentUri: URI | undefined;

  const testEditorGroup: IEditorGroup = {
    open: jest.fn((uri) => {
      currentUri = uri;
    }),
    currentEditor: {
      getSelections: () => [selection],
    },
    index: 0,
  } as any;

  injector.mockService(WorkbenchEditorService, {
    currentEditorGroup: testEditorGroup,
  });

  it('history basic tests', () => {
    const historyService: EditorHistoryService = injector.get(EditorHistoryService);
    const eventBus: IEventBus = injector.get(IEventBus);

    selection = {
      selectionStartColumn: 1,
      selectionStartLineNumber: 1,
      positionColumn: 1,
      positionLineNumber: 1,
    };

    const testUri1 = new URI('file:///test_uri1.ts');
    const testUri2 = new URI('file:///test_uri2.ts');
    const testUri3 = new URI('file:///test_uri3.ts');

    // 一定会先发一个这个, 此时 selection 是初始的 1，1
    eventBus.fire(
      new EditorGroupChangeEvent({
        group: testEditorGroup,
        newOpenType: {
          type: EditorOpenType.code,
        },
        oldOpenType: null,
        newResource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
        oldResource: null,
      }),
    );

    selection = {
      selectionStartColumn: 10,
      selectionStartLineNumber: 20,
      positionColumn: 10,
      positionLineNumber: 20,
    };

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(1);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    eventBus.fire(
      new EditorSelectionChangeEvent({
        group: testEditorGroup,
        selections: [selection],
        resource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
        editorUri: testUri1,
        source: 'test',
      }),
    );

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(10);
    expect(historyService.currentState.position.lineNumber).toBe(20);

    selection = {
      selectionStartColumn: 2,
      selectionStartLineNumber: 21,
      positionColumn: 10,
      positionLineNumber: 21,
    };

    eventBus.fire(
      new EditorSelectionChangeEvent({
        group: testEditorGroup,
        selections: [selection],
        resource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
        editorUri: testUri1,
        source: 'test',
      }),
    );

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(2);
    expect(historyService.currentState.position.lineNumber).toBe(21);

    selection = {
      selectionStartColumn: 10,
      selectionStartLineNumber: 1,
      positionColumn: 10,
      positionLineNumber: 1,
    };

    eventBus.fire(
      new EditorSelectionChangeEvent({
        group: testEditorGroup,
        selections: [selection],
        resource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
        editorUri: testUri1,
        source: 'test',
      }),
    );

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(10);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    selection = {
      selectionStartColumn: 1,
      selectionStartLineNumber: 1,
      positionColumn: 1,
      positionLineNumber: 1,
    };

    eventBus.fire(
      new EditorGroupChangeEvent({
        group: testEditorGroup,
        newOpenType: {
          type: EditorOpenType.code,
        },
        oldOpenType: {
          type: EditorOpenType.code,
        },
        newResource: {
          uri: testUri2,
          name: 'test2',
          icon: 'test',
        },
        oldResource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
      }),
    );

    selection = {
      selectionStartColumn: 2,
      selectionStartLineNumber: 2,
      positionColumn: 2,
      positionLineNumber: 2,
    };

    eventBus.fire(
      new EditorSelectionChangeEvent({
        group: testEditorGroup,
        selections: [selection],
        resource: {
          uri: testUri2,
          name: 'test2',
          icon: 'test',
        },
        editorUri: testUri2,
        source: 'test',
      }),
    );

    selection = {
      selectionStartColumn: 1,
      selectionStartLineNumber: 1,
      positionColumn: 1,
      positionLineNumber: 1,
    };

    eventBus.fire(
      new EditorGroupChangeEvent({
        group: testEditorGroup,
        newOpenType: {
          type: EditorOpenType.code,
        },
        oldOpenType: {
          type: EditorOpenType.code,
        },
        newResource: {
          uri: testUri3,
          name: 'test3',
          icon: 'test',
        },
        oldResource: {
          uri: testUri1,
          name: 'test1',
          icon: 'test',
        },
      }),
    );

    // testUri3 不选中 focus, 不发送 SelectionChangeEvent

    expect(historyService.currentState.uri).toBe(testUri3);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(1);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    historyService.back();

    expect(historyService.currentState.uri).toBe(testUri2);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(2);
    expect(historyService.currentState.position.lineNumber).toBe(2);

    historyService.back();

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(10);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    historyService.back();

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(2);
    expect(historyService.currentState.position.lineNumber).toBe(21);

    historyService.forward();

    expect(historyService.currentState.uri).toBe(testUri1);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(10);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    historyService.forward();

    expect(historyService.currentState.uri).toBe(testUri2);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(2);
    expect(historyService.currentState.position.lineNumber).toBe(2);

    historyService.forward();

    expect(historyService.currentState.uri).toBe(testUri3);
    expect(historyService.currentState.groupIndex).toBe(0);
    expect(historyService.currentState.position.column).toBe(1);
    expect(historyService.currentState.position.lineNumber).toBe(1);

    eventBus.fire(
      new EditorGroupCloseEvent({
        group: testEditorGroup,
        resource: {
          uri: testUri3,
          name: 'test3',
          icon: 'test',
        },
      }),
    );

    historyService.popClosed();

    expect(currentUri).toBe(testUri3);
  });
});

describe('editor menu test', () => {
  let injector: MockInjector;

  afterAll(() => {
    (global as any).monaco = undefined;
  });
  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.mockService(AbstractContextMenuService, {
      createMenu: () => ({
        getMergedMenuNodes: () => ['Menu1', 'Menu2'],
        dispose: () => null,
      }),
    });
    injector.mockService(IContextKeyService, {
      createKey: jest.fn(() => ({
        set: jest.fn(),
        get: jest.fn(),
      })),
      parse: (expr) => ({
        keys: () => [],
        expr,
      }),
      createScoped: () => ({
        createKey: jest.fn(() => ({
          set: jest.fn(),
        })),
        dispose: () => null,
      }),
    });
    injector.mockService(ICtxMenuRenderer);
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('editor context menu test', () => {
    const [ctxController] = EditorExtensionsRegistry.getSomeEditorContributions([EditorContextMenuController.ID]);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    ctxController.ctor = new SyncDescriptor(EditorContextMenuController, [
      injector.get(AbstractContextMenuService),
      injector.get(IContextKeyService),
      injector.get(ICtxMenuRenderer),
    ]);

    const monacoEditor = monacoApi.editor.create(document.createElement('div'));
    const model = monacoApi.editor.createModel('test');
    monacoEditor.setModel(model);

    const editor = {
      monacoEditor,
      currentDocumentModel: {},
    };

    editor.monacoEditor['_onContextMenu'].fire({
      target: { type: 1 } as any,
      event: {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        posx: 0,
        posy: 0,
      } as any,
    });

    expect(injector.get<ICtxMenuRenderer>(ICtxMenuRenderer).show).toHaveBeenCalled();
  });

  it('editor title context menu test', () => {
    const service = injector.get(TabTitleMenuService);
    service.show(0, 0, new URI('file:///test1.ts'), {
      contextKeyService: {
        createScoped: jest.fn(() => ({
          createKey: jest.fn(() => ({
            set: jest.fn(),
            get: jest.fn(),
          })),
          dispose: () => null,
        })),
      },
    } as any);
    expect(injector.get<ICtxMenuRenderer>(ICtxMenuRenderer).show).toHaveBeenCalled();
  });
});
