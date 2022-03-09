import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { PreferenceChange } from '@opensumi/ide-core-browser';
import {
  DisposableCollection,
  PreferenceScope,
  Uri,
  URI,
  Emitter,
  CommandService,
  toDisposable,
} from '@opensumi/ide-core-common';
import { WorkbenchEditorService, IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import {
  IEditorFeatureRegistry,
  IEditorFeatureContribution,
  EmptyDocCacheImpl,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/src/browser';
import { IEditorDocumentModel } from '@opensumi/ide-editor/src/browser/';
import { EditorDocumentModel } from '@opensumi/ide-editor/src/browser/doc-model/main';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/src/browser/workbench-editor.service';
import { monaco as monacoAPI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { IDirtyDiffWorkbenchController } from '../../../src';
import { DirtyDiffWorkbenchController, DirtyDiffItem } from '../../../src/browser/dirty-diff';
import { DirtyDiffDecorator } from '../../../src/browser/dirty-diff/dirty-diff-decorator';
import { DirtyDiffModel } from '../../../src/browser/dirty-diff/dirty-diff-model';
import { DirtyDiffWidget } from '../../../src/browser/dirty-diff/dirty-diff-widget';
import { SCMPreferences } from '../../../src/browser/scm-preference';

jest.useFakeTimers();

@Injectable()
class MockEditorDocumentModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private readonly instances: Map<string, EditorDocumentModel> = new Map();

  async createModelReference(uri: URI): Promise<EditorDocumentModel> {
    if (!this.instances.has(uri.toString())) {
      const instance = this.injector.get(EditorDocumentModel, [uri, 'test-content']);
      this.instances.set(uri.toString(), instance);
    }
    return this.instances.get(uri.toString())!;
  }
}

@Injectable()
class MockPreferenceService {
  readonly onPreferenceChangedEmitter = new Emitter<PreferenceChange>();
  readonly onPreferenceChanged = this.onPreferenceChangedEmitter.event;

  preferences: Map<string, any> = new Map();

  get(k) {
    return this.preferences.get(k);
  }

  set(k, v) {
    this.preferences.set(k, v);
  }

  'scm.alwaysShowDiffWidget' = true;
  'scm.diffDecorations' = 'all';
  'scm.diffDecorationsGutterWidth' = 3;
}

describe('scm/src/browser/dirty-diff/index.ts', () => {
  let injector: MockInjector;

  let dirtyDiffWorkbenchController: DirtyDiffWorkbenchController;
  let scmPreferences: MockPreferenceService;

  const editorFeatureContributions = new Set<IEditorFeatureContribution>();
  let monacoEditor: IMonacoCodeEditor;
  let editorModel: IEditorDocumentModel;
  let commandService: CommandService;
  let editorService: WorkbenchEditorService;

  async function createModel(filePath: string): Promise<EditorDocumentModel> {
    const fileTextModel = injector.get(EditorDocumentModel, [URI.file(filePath), 'test-content']);
    return fileTextModel;
  }

  beforeEach(async (done) => {
    injector = createBrowserInjector(
      [],
      new Injector([
        {
          token: IDocPersistentCacheProvider,
          useClass: EmptyDocCacheImpl,
        },
        {
          token: IEditorDocumentModelService,
          useClass: MockEditorDocumentModelService,
        },
        {
          token: SCMPreferences,
          useClass: MockPreferenceService,
        },
        {
          token: IEditorFeatureRegistry,
          useValue: {
            registerEditorFeatureContribution: (contribution) => {
              editorFeatureContributions.add(contribution);
              return toDisposable(() => {
                editorFeatureContributions.delete(contribution);
              });
            },
            runContributions: jest.fn(),
            runProvideEditorOptionsForUri: jest.fn(),
          },
        },
        {
          token: CommandService,
          useValue: {
            executeCommand: jest.fn(),
          },
        },
        {
          token: WorkbenchEditorService,
          useClass: WorkbenchEditorServiceImpl,
        },
        {
          token: IDirtyDiffWorkbenchController,
          useClass: DirtyDiffWorkbenchController,
        },
      ]),
    );

    editorService = injector.get(WorkbenchEditorService);
    scmPreferences = injector.get(SCMPreferences);
    commandService = injector.get(CommandService);
    dirtyDiffWorkbenchController = injector.get(IDirtyDiffWorkbenchController);
    editorModel = await createModel(`/test/workspace/abc${Math.random()}.ts`);
    monacoEditor = monacoAPI.editor!.create(document.createElement('div'), { language: 'typescript' });
    monacoEditor.setModel(editorModel.getMonacoModel());
    done();
  });

  afterEach(() => {
    editorFeatureContributions.clear();
    monacoEditor.setModel(null);
  });

  it('ok for attachEvents', () => {
    dirtyDiffWorkbenchController.start();

    expect(editorFeatureContributions.size).toBe(1);

    const mouseDownSpy = jest.spyOn(monacoEditor, 'onMouseDown');
    const didChangeModelSpy = jest.spyOn(monacoEditor, 'onDidChangeModel');

    // execute editor contribution
    [...editorFeatureContributions][0].contribute({ monacoEditor } as any);
    expect(mouseDownSpy).toBeCalledTimes(1);
    expect(didChangeModelSpy).toBeCalledTimes(1);

    const $div = document.createElement('div');
    $div.classList.add('dirty-diff-glyph');

    const toggleWidgetSpy = jest.spyOn(dirtyDiffWorkbenchController, 'toggleDirtyDiffWidget');

    monacoEditor['_onMouseDown'].fire({
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS,
        element: $div,
        position: {
          lineNumber: 10,
          column: 5,
        },
        detail: {
          offsetX: 3,
        },
      },
    });
    // _doMouseDown
    // gutterOffsetX < 5
    expect(toggleWidgetSpy).toBeCalledTimes(1);

    monacoEditor['_onMouseDown'].fire({
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS,
        element: $div,
        position: {
          lineNumber: 10,
          column: 5,
        },
        detail: {
          offsetX: 8,
        },
      },
    });
    // _doMouseDown
    // gutterOffsetX >= 5
    expect(toggleWidgetSpy).toBeCalledTimes(1);
    expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).toBeUndefined();

    const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
    const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);
    dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);
    expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).not.toBeUndefined();

    monacoEditor['_onMouseDown'].fire({
      target: {
        type: monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS,
        element: $div,
        position: {
          lineNumber: 10,
          column: 5,
        },
        detail: {
          offsetX: 18,
        },
      },
    });
    // _doMouseDown
    // gutterOffsetX >= 5
    expect(toggleWidgetSpy).toBeCalledTimes(1);
    expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).toBeUndefined();

    monacoEditor['_onDidChangeModel'].fire({
      oldModelUrl: null,
      newModelUrl: Uri.file('def0.ts'),
    });
    // nothing happened

    monacoEditor['_onDidChangeModel'].fire({
      oldModelUrl: Uri.file('abc1.ts'),
      newModelUrl: Uri.file('def1.ts'),
    });
    // nothing happened

    dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);

    const disposeSpy = jest.spyOn(dirtyDiffWidget, 'dispose');
    monacoEditor['_onDidChangeModel'].fire({
      oldModelUrl: Uri.file('abc2.ts'),
      newModelUrl: Uri.file('def2.ts'),
    });
    // oldWidget.dispose
    expect(disposeSpy).toBeCalledTimes(1);

    const disposeSpy1 = jest.spyOn(DisposableCollection.prototype, 'dispose');
    monacoEditor['_onDidDispose'].fire();
    // disposeCollection.dispose();
    expect(disposeSpy).toBeCalledTimes(1);

    [mouseDownSpy, didChangeModelSpy, toggleWidgetSpy, disposeSpy, disposeSpy1].forEach((spy) => {
      spy.mockReset();
    });
  });

  it('ok for scm.alwaysShowDiffWidget changes', () => {
    dirtyDiffWorkbenchController.start();

    const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
    const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);
    dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);

    const disposeSpy = jest.spyOn(dirtyDiffWidget, 'dispose');

    scmPreferences.onPreferenceChangedEmitter.fire({
      preferenceName: 'scm.alwaysShowDiffWidget',
      scope: PreferenceScope.User,
      newValue: true,
      affects: () => false,
    });

    expect(disposeSpy).toBeCalledTimes(0);

    scmPreferences.onPreferenceChangedEmitter.fire({
      preferenceName: 'scm.diffDecorationsGutterWidth',
      scope: PreferenceScope.User,
      newValue: false,
      affects: () => false,
    });

    expect(disposeSpy).toBeCalledTimes(0);

    scmPreferences.onPreferenceChangedEmitter.fire({
      preferenceName: 'scm.alwaysShowDiffWidget',
      scope: PreferenceScope.User,
      newValue: false,
      affects: () => false,
    });

    expect(disposeSpy).toBeCalled();

    disposeSpy.mockReset();
  });

  it('ok for scm.diffDecorations changes', () => {
    dirtyDiffWorkbenchController.start();

    const enableSpy = jest.spyOn<any, any>(dirtyDiffWorkbenchController, 'enable');
    const disableSpy = jest.spyOn<any, any>(dirtyDiffWorkbenchController, 'disable');

    scmPreferences['scm.diffDecorations'] = 'none';
    scmPreferences.onPreferenceChangedEmitter.fire({
      preferenceName: 'scm.diffDecorations',
      scope: PreferenceScope.User,
      newValue: 'none',
      affects: () => true,
    });
    // first disabled called when enabled#true
    expect(disableSpy).toBeCalled();

    scmPreferences['scm.diffDecorations'] = 'all';
    scmPreferences.onPreferenceChangedEmitter.fire({
      preferenceName: 'scm.diffDecorations',
      scope: PreferenceScope.User,
      newValue: 'all',
      affects: () => true,
    });

    expect(enableSpy).toBeCalled();

    [enableSpy, disableSpy].forEach((spy) => {
      spy.mockReset();
    });
  });

  it('ok for enable/disable', () => {
    dirtyDiffWorkbenchController.start();

    const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
    const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);
    dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);

    dirtyDiffWorkbenchController['enabled'] = false;

    const docModel1 = injector.get(EditorDocumentModel, [URI.file('/test/workspace/abc.ts'), 'test']);

    editorService.editorGroups.push({
      currentOpenType: { type: 'code' },
      currentEditor: {
        currentDocumentModel: docModel1,
      },
    } as any);

    dirtyDiffWorkbenchController['enable']();

    expect(dirtyDiffWorkbenchController['enabled']).toBeTruthy();
    expect(dirtyDiffWorkbenchController['models'].length).toBe(1);
    const textModel1 = docModel1.getMonacoModel();
    // dirtyDiff 里使用的 model 是 EditorDocumentModel
    // 每个 EditorDocumentModel 持有一个 monaco.editor.ITextModel 对象
    expect(dirtyDiffWorkbenchController['models'][0]).toEqual(docModel1);
    expect(dirtyDiffWorkbenchController['models'][0].getMonacoModel()).toEqual(textModel1);
    expect(dirtyDiffWorkbenchController['items'][docModel1.id]).not.toBeUndefined();

    editorService.editorGroups.pop();
    // old models
    dirtyDiffWorkbenchController['models'].push(
      injector.get(EditorDocumentModel, [URI.file('/test/workspace/def1.ts'), 'test']),
    );

    const docModel2 = injector.get(EditorDocumentModel, [URI.file('/test/workspace/def2.ts'), 'test']);

    editorService.editorGroups.push({
      currentOpenType: { type: 'diff' },
      currentEditor: {
        currentDocumentModel: docModel2,
      },
    } as any);
    editorService.editorGroups.push({
      currentOpenType: { type: 'code' },
      currentEditor: {
        currentDocumentModel: docModel2,
      },
    } as any);

    editorService.editorGroups.push({
      currentOpenType: { type: 'code' },
      currentEditor: null,
    } as any);

    // eventBus.fire(new EditorGroupChangeEvent({} as any));
    dirtyDiffWorkbenchController['enable']();

    expect(dirtyDiffWorkbenchController['models'].length).toBe(1);
    const textModel2 = docModel2.getMonacoModel();
    expect(dirtyDiffWorkbenchController['models'][0]).toEqual(docModel2);
    expect(dirtyDiffWorkbenchController['models'][0].getMonacoModel()).toEqual(textModel2);
    expect(dirtyDiffWorkbenchController['items'][docModel2.id].model).not.toBeUndefined();

    dirtyDiffWorkbenchController['disable']();
    expect(dirtyDiffWorkbenchController['enabled']).toBeFalsy();
    expect(dirtyDiffWorkbenchController['models']).toEqual([]);
    expect(dirtyDiffWorkbenchController['items']).toEqual({});

    dirtyDiffWorkbenchController['models'].push(
      injector.get(EditorDocumentModel, [URI.file('/test/workspace/def4.ts'), 'test']),
    );
    dirtyDiffWorkbenchController['disable']();
    expect(dirtyDiffWorkbenchController['models'].length).toBe(1);
  });

  it('dispose', () => {
    dirtyDiffWorkbenchController.start();

    const disableSpy = jest.spyOn<any, any>(dirtyDiffWorkbenchController, 'disable');
    const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
    const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);
    dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);
    const disposeSpy = jest.spyOn(dirtyDiffWidget, 'dispose');

    dirtyDiffWorkbenchController.dispose();
    expect(disableSpy).toBeCalledTimes(1);
    expect(dirtyDiffWorkbenchController['widgets'].size).toBe(0);
    expect(disposeSpy).toBeCalledTimes(1);
  });

  describe('toggleDirtyDiffWidget', () => {
    it('ok', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffDecorator = injector.get(DirtyDiffDecorator, [editorModel, dirtyDiffModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);

      const change0 = {
        originalStartLineNumber: 11,
        originalEndLineNumber: 11,
        modifiedStartLineNumber: 11,
        modifiedEndLineNumber: 11,
      };
      const change1 = {
        originalStartLineNumber: 12,
        originalEndLineNumber: 12,
        modifiedStartLineNumber: 12,
        modifiedEndLineNumber: 12,
      };

      dirtyDiffModel['_changes'] = [change0, change1];
      dirtyDiffWidget.updateCurrent(1);

      dirtyDiffWorkbenchController['items'] = {
        [editorModel.id]: new DirtyDiffItem(dirtyDiffModel, dirtyDiffDecorator),
      };
      dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);

      const spy = jest.spyOn(dirtyDiffWidget, 'dispose');

      // first invoke
      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, {
        lineNumber: 11,
        column: 5,
      });
      expect(spy).toBeCalledTimes(1);
      // same: currentIndex === targetIndex
      expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).toBe(dirtyDiffWidget);

      dirtyDiffWidget.updateCurrent(2);
      // second invoke
      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, {
        lineNumber: 11,
        column: 5,
      });
      expect(spy).toBeCalledTimes(2);
      // 创建一个新的 widget
      expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).not.toBe(dirtyDiffWidget);

      // no widget
      // 3th invoke
      const existedWidget = dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId());
      dirtyDiffWorkbenchController['widgets'].delete(monacoEditor.getId());
      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, {
        lineNumber: 11,
        column: 5,
      });

      expect(spy).toBeCalledTimes(2);
      // 创建一个新的 widget
      const latestWidget = dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId());
      expect(latestWidget).not.toBe(existedWidget);

      // dirty-diff-widget dispose
      // latestWidget!.dispose();
      // expect(dirtyDiffWorkbenchController['widgets'].get(monacoEditor.getId())).toBeUndefined();

      spy.mockReset();
    });

    it('no dirtyDiffModel', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [monacoEditor, dirtyDiffModel, commandService]);

      const spy = jest.spyOn(dirtyDiffWidget, 'dispose');

      dirtyDiffWorkbenchController['widgets'].set(monacoEditor.getId(), dirtyDiffWidget);

      dirtyDiffWorkbenchController['items'] = {};

      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, {
        lineNumber: 11,
        column: 5,
      });

      expect(spy).not.toBeCalled();
      spy.mockReset();
    });

    it('no position', () => {
      const spy = jest.spyOn(dirtyDiffWorkbenchController['widgets'], 'get');

      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, undefined as any);

      expect(spy).not.toBeCalled();

      spy.mockReset();
    });

    it('no model', () => {
      monacoEditor.setModel(null);

      const spy = jest.spyOn(dirtyDiffWorkbenchController['widgets'], 'get');

      dirtyDiffWorkbenchController.toggleDirtyDiffWidget(monacoEditor, {
        lineNumber: 10,
        column: 5,
      });

      expect(spy).not.toBeCalled();

      spy.mockReset();
    });
  });
});
