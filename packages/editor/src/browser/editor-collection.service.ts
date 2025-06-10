import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IContextKeyService, PreferenceService } from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey';
import { MonacoService } from '@opensumi/ide-core-browser/lib/monaco';
import {
  Emitter,
  Event,
  Emitter as EventEmitter,
  ILineChange,
  OnEvent,
  URI,
  WithEventBus,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import {
  CursorStatus,
  DIFF_SCHEME,
  EditorCollectionService,
  EditorType,
  ICodeEditor,
  IDiffEditor,
  IEditor,
  IResourceOpenOptions,
  ResourceDecorationNeedChangeEvent,
} from '../common';
import { IEditorDocumentModelRef, isTextEditorViewState } from '../common/editor';
import { IMultiDiffEditor } from '../common/multi-diff';

import { BaseMonacoEditorWrapper, DiffEditorPart, ISumiEditor } from './base-editor-wrapper';
import { EditorDocumentModelContentChangedEvent, IEditorDocumentModelService } from './doc-model/types';
import { EditorFeatureRegistryImpl } from './feature';
import { BrowserMultiDiffEditor } from './multi-diff/multi-diff-editor';
import { getConvertedMonacoOptions, isDiffEditorOption } from './preference/converter';
import { IConvertedMonacoOptions, IEditorFeatureRegistry } from './types';

import type {
  ICodeEditor as IMonacoCodeEditor,
  IDiffEditor as IMonacoDiffEditor,
} from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import type { IDiffEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

@Injectable()
export class EditorCollectionServiceImpl extends WithEventBus implements EditorCollectionService {
  @Autowired()
  protected readonly monacoService: MonacoService;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IConfigurationService)
  protected readonly configurationService: IConfigurationService;

  @Autowired(IEditorFeatureRegistry)
  protected readonly editorFeatureRegistry: EditorFeatureRegistryImpl;

  private _editors: Set<ISumiEditor> = new Set();
  private _diffEditors: Set<IDiffEditor> = new Set();
  private _multiDiffEditors: Set<IMultiDiffEditor> = new Set();

  private _onCodeEditorCreate = new Emitter<ICodeEditor>();
  private _onDiffEditorCreate = new Emitter<IDiffEditor>();
  private _onMultiDiffEditorCreate = new Emitter<IMultiDiffEditor>();

  private _onCodeEditorChange = new Emitter<void>();
  private _onDiffEditorChange = new Emitter<void>();
  private _onMultiDiffEditorChange = new Emitter<void>();

  public onCodeEditorCreate = this._onCodeEditorCreate.event;
  public onDiffEditorCreate = this._onDiffEditorCreate.event;
  public onMultiDiffEditorCreate = this._onMultiDiffEditorCreate.event;

  public onCodeEditorChange = this._onCodeEditorChange.event;
  public onDiffEditorChange = this._onDiffEditorChange.event;
  public onMultiDiffEditorChange = this._onMultiDiffEditorChange.event;

  @Autowired(IEditorDocumentModelService)
  documentModelService: IEditorDocumentModelService;

  private _currentEditor: IEditor | undefined;

  get currentEditor() {
    return this._currentEditor;
  }

  constructor() {
    super();
    this.addDispose(
      this.editorFeatureRegistry.onDidRegisterFeature((contribution) => {
        this._editors.forEach((editor) => {
          this.editorFeatureRegistry.runOneContribution(editor, contribution);
        });
      }),
    );
  }

  createCodeEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }): ICodeEditor {
    const mergedOptions = { ...getConvertedMonacoOptions(this.configurationService).editorOptions, ...options };
    const monacoCodeEditor = this.monacoService.createCodeEditor(dom, mergedOptions, overrides);
    const editor = this.injector.get(BrowserCodeEditor, [monacoCodeEditor, options]);

    this._onCodeEditorCreate.fire(editor);
    return editor;
  }

  public listEditors(): ISumiEditor[] {
    return Array.from(this._editors.values());
  }

  getEditorByUri(uri: URI): IEditor | undefined {
    for (const editor of this._editors.values()) {
      if (editor.currentUri?.isEqual(uri)) {
        return editor;
      }
    }
  }

  public addEditors(editors: ISumiEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      let exist = false;
      // 查找是否存在相同 URI 的 editor
      const existingEditor = Array.from(this._editors).find(
        (e) => e.currentUri && editor.currentUri && e.currentUri.isEqual(editor.currentUri),
      );

      // 如果存在相同 URI 的 editor，先移除它
      if (existingEditor) {
        if (existingEditor.monacoEditor.getId() === editor.monacoEditor.getId()) {
          exist = true;
        }
      }

      if (!exist) {
        this._editors.add(editor);
        this.editorFeatureRegistry.runContributions(editor);
        editor.monacoEditor.onDidFocusEditorWidget(() => {
          this._currentEditor = editor;
        });
        editor.monacoEditor.onContextMenu(() => {
          this._currentEditor = editor;
        });
      } else {
        editor.decorationApplier.clearDecorations();
        editor.decorationApplier.applyDecorationFromProvider();
      }
    });
    if (this._editors.size !== beforeSize) {
      this._onCodeEditorChange.fire();
    }
  }

  public removeEditors(editors: ISumiEditor[]) {
    const beforeSize = this._editors.size;
    editors.forEach((editor) => {
      this._editors.delete(editor);
      if (this._currentEditor === editor) {
        this._currentEditor = undefined;
      }
    });
    if (this._editors.size !== beforeSize) {
      this._onCodeEditorChange.fire();
    }
  }

  public createDiffEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }): IDiffEditor {
    const convertedOptions = getConvertedMonacoOptions(this.configurationService);
    const mergedOptions = { ...convertedOptions.editorOptions, ...convertedOptions.diffOptions, ...options };
    const monacoDiffEditor = this.monacoService.createDiffEditor(dom, mergedOptions, overrides);
    const editor = this.injector.get(BrowserDiffEditor, [monacoDiffEditor, options]);
    this._onDiffEditorCreate.fire(editor);
    return editor;
  }

  public createMultiDiffEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }): IMultiDiffEditor {
    const convertedOptions = getConvertedMonacoOptions(this.configurationService);
    const monacoMultiDiffEditorWidget = this.monacoService.createMultiDiffEditorWidget(dom, overrides);
    const mergedOptions: IConvertedMonacoOptions = { ...convertedOptions.diffOptions, ...options };
    const editor = this.injector.get(BrowserMultiDiffEditor, [monacoMultiDiffEditorWidget, mergedOptions, this]);
    return editor as IMultiDiffEditor;
  }

  public createMergeEditor(dom: HTMLElement, options?: any, overrides?: { [key: string]: any }) {
    const convertedOptions = getConvertedMonacoOptions(this.configurationService);
    const mergedOptions: IDiffEditorConstructionOptions = {
      ...convertedOptions.editorOptions,
      ...convertedOptions.diffOptions,
      ...options,
      // merge editor not support wordWrap
      wordWrap: 'off',
    };
    const editor = this.monacoService.createMergeEditor(dom, mergedOptions, overrides);
    return editor;
  }

  public listDiffEditors(): IDiffEditor[] {
    return Array.from(this._diffEditors.values());
  }

  public addDiffEditors(diffEditors: IDiffEditor[]) {
    const beforeSize = this._diffEditors.size;
    diffEditors.forEach((diffEditor) => {
      if (!this._diffEditors.has(diffEditor)) {
        this._diffEditors.add(diffEditor);
      }
    });
    if (this._diffEditors.size !== beforeSize) {
      this._onDiffEditorChange.fire();
    }
  }

  public removeDiffEditors(diffEditors: IDiffEditor[]) {
    const beforeSize = this._diffEditors.size;
    diffEditors.forEach((diffEditor) => {
      this._diffEditors.delete(diffEditor);
    });
    if (this._diffEditors.size !== beforeSize) {
      this._onDiffEditorChange.fire();
    }
  }

  public listMultiDiffEditors(): IMultiDiffEditor[] {
    return Array.from(this._multiDiffEditors.values());
  }

  public addMultiDiffEditors(multiDiffEditors: IMultiDiffEditor[]) {
    const beforeSize = this._multiDiffEditors.size;
    multiDiffEditors.forEach((multiDiffEditor) => {
      if (!this._multiDiffEditors.has(multiDiffEditor)) {
        this._multiDiffEditors.add(multiDiffEditor);
      }
    });
    if (this._multiDiffEditors.size !== beforeSize) {
      this._onMultiDiffEditorChange.fire();
    }
  }

  public removeMultiDiffEditors(multiDiffEditors: IMultiDiffEditor[]) {
    const beforeSize = this._multiDiffEditors.size;
    multiDiffEditors.forEach((multiDiffEditor) => {
      this._multiDiffEditors.delete(multiDiffEditor);
    });
    if (this._multiDiffEditors.size !== beforeSize) {
      this._onMultiDiffEditorChange.fire();
    }
  }

  @OnEvent(EditorDocumentModelContentChangedEvent)
  onDocModelContentChangedEvent(e: EditorDocumentModelContentChangedEvent) {
    this.eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: e.payload.uri,
        decoration: {
          dirty: !!e.payload.dirty,
          readOnly: !!e.payload.readonly,
        },
      }),
    );
  }
}

@Injectable({ multiple: true })
export class BrowserCodeEditor extends BaseMonacoEditorWrapper implements ICodeEditor {
  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  @Autowired(IEditorFeatureRegistry)
  protected readonly editorFeatureRegistry: IEditorFeatureRegistry;

  private editorState: Map<string, monaco.editor.ICodeEditorViewState> = new Map();

  protected _currentDocumentModelRef: IEditorDocumentModelRef;

  private _onCursorPositionChanged = new EventEmitter<CursorStatus>();
  public onCursorPositionChanged = this._onCursorPositionChanged.event;

  private _onRefOpen = new Emitter<IEditorDocumentModelRef>();

  public onRefOpen = this._onRefOpen.event;

  public get currentDocumentModel() {
    if (this._currentDocumentModelRef && !this._currentDocumentModelRef.disposed) {
      return this._currentDocumentModelRef.instance;
    } else {
      return null;
    }
  }

  getType() {
    return EditorType.CODE;
  }

  constructor(public readonly monacoEditor: IMonacoCodeEditor, options: any = {}) {
    super(monacoEditor, EditorType.CODE);

    this._specialEditorOptions = options;
    this.collectionService.addEditors([this]);
    // 防止浏览器后退前进手势
    const disposer = monacoEditor.onDidChangeModel(() => {
      bindPreventNavigation(this.monacoEditor.getDomNode()!);
      disposer.dispose();
    });
    this.addDispose(
      monacoEditor.onDidChangeCursorPosition(() => {
        if (!this.currentDocumentModel) {
          return;
        }
        const selection = monacoEditor.getSelection();
        this._onCursorPositionChanged.fire({
          position: monacoEditor.getPosition(),
          selectionLength: selection ? this.currentDocumentModel.getMonacoModel().getValueInRange(selection).length : 0,
        });
      }),
    );

    this.addDispose(this.monacoEditor);
  }

  layout(dimension?: monaco.IDimension, postponeRendering: boolean = false): void {
    this.monacoEditor.layout(dimension, postponeRendering);
  }

  focus(): void {
    this.monacoEditor.focus();
  }

  dispose() {
    super.dispose();
    this.saveCurrentState();
    this.collectionService.removeEditors([this]);
  }

  protected saveCurrentState() {
    if (this.currentUri) {
      const state = this.monacoEditor.saveViewState();
      if (state) {
        this.editorState.set(this.currentUri.toString(), state);
      }
    }
  }

  protected restoreState() {
    if (this.currentUri) {
      const state = this.editorState.get(this.currentUri.toString());
      if (isTextEditorViewState(state)) {
        this.monacoEditor.restoreViewState(state);
      }
    }
  }

  open(documentModelRef: IEditorDocumentModelRef): void {
    this.saveCurrentState();
    this._currentDocumentModelRef = documentModelRef;
    const model = this.currentDocumentModel!.getMonacoModel();

    this.disableSelectionEmitter();
    this.monacoEditor.setModel(model);
    this.enableSelectionEmitter();
    this.restoreState();

    this._onRefOpen.fire(documentModelRef);
    // monaco 在文件首次打开时不会触发 cursorChange
    this._onCursorPositionChanged.fire({
      position: this.monacoEditor.getPosition(),
      selectionLength: 0,
    });

    const { instance } = documentModelRef;

    /**
     * 这里需要触发一下 monaco 的更新
     */
    this.updateOptions();

    this.eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: instance.uri,
        decoration: {
          readOnly: instance.readonly,
        },
      }),
    );
  }
}

export class BrowserDiffEditor extends WithEventBus implements IDiffEditor {
  @Autowired(EditorCollectionService)
  private collectionService: EditorCollectionServiceImpl;

  private originalDocModelRef: IEditorDocumentModelRef | null;

  private modifiedDocModelRef: IEditorDocumentModelRef | null;

  get originalDocModel() {
    if (this.originalDocModelRef && !this.originalDocModelRef.disposed) {
      return this.originalDocModelRef.instance;
    }
    return null;
  }

  get modifiedDocModel() {
    if (this.modifiedDocModelRef && !this.modifiedDocModelRef.disposed) {
      return this.modifiedDocModelRef.instance;
    }
    return null;
  }

  public originalEditor: ISumiEditor;

  public modifiedEditor: ISumiEditor;

  public _disposed: boolean;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IConfigurationService)
  protected readonly configurationService: IConfigurationService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  private editorState: Map<string, monaco.editor.IDiffEditorViewState> = new Map();

  private currentUri: URI | undefined;

  private diffResourceKeys: ResourceContextKey[];

  private _onRefOpen = new Emitter<IEditorDocumentModelRef>();

  public onRefOpen = this._onRefOpen.event;

  protected saveCurrentState() {
    if (this.currentUri) {
      const state = this.monacoDiffEditor.saveViewState();
      if (state) {
        this.editorState.set(this.currentUri.toString(), state);
      }
    }
  }

  protected restoreState(options: IResourceOpenOptions) {
    if (this.currentUri) {
      const state = this.editorState.get(this.currentUri.toString());
      if (isTextEditorViewState(state)) {
        if (options.range || options.originalRange) {
          state.modified!.cursorState = []; // 避免重复的选中态
        }
        this.monacoDiffEditor.restoreViewState(state);
      }
    }
  }

  constructor(public readonly monacoDiffEditor: IMonacoDiffEditor, private specialOptions: any = {}) {
    super();
    this.wrapEditors();
    this.addDispose(
      this.configurationService.onDidChangeConfiguration((e) => {
        const changedEditorKeys = Array.from(e.affectedKeys.values()).filter((key) => isDiffEditorOption(key));
        if (changedEditorKeys.length > 0) {
          this.updateDiffOptions();
        }
      }),
    );
  }

  async compare(
    originalDocModelRef: IEditorDocumentModelRef,
    modifiedDocModelRef: IEditorDocumentModelRef,
    options: IResourceOpenOptions = {},
    rawUri?: URI,
  ) {
    this.saveCurrentState(); // 保存上一个状态
    this.originalDocModelRef = originalDocModelRef;
    this.modifiedDocModelRef = modifiedDocModelRef;
    if (!this.originalDocModel || !this.modifiedDocModel) {
      return;
    }
    const original = this.originalDocModel.getMonacoModel();
    const modified = this.modifiedDocModel.getMonacoModel();
    const model = this.monacoDiffEditor.createViewModel({ original, modified });
    this.monacoDiffEditor.setModel(model);

    if (rawUri) {
      this.currentUri = rawUri;
    } else {
      this.currentUri = URI.from({
        scheme: DIFF_SCHEME,
        query: URI.stringifyQuery({
          name,
          original: this.originalDocModel!.uri.toString(),
          modified: this.modifiedDocModel!.uri.toString(),
        }),
      });
    }
    await model?.waitForDiff();

    // 需要等待 Diff 渲染，否则无法获取当前的 Diff 代码折叠状态
    this.restoreState(options);

    if (options.range || options.originalRange) {
      const range = (options.range || options.originalRange) as monaco.IRange;
      const currentEditor = options.range ? this.modifiedEditor.monacoEditor : this.originalEditor.monacoEditor;
      // 必须使用 setTimeout, 因为两边的 editor 出现时机问题，diffEditor 是异步显示和渲染
      setTimeout(() => {
        currentEditor.revealRangeInCenter(range);
        currentEditor.setSelection(range);
      });
      // monaco diffEditor 在 setModel 后，计算 diff 完成后, 左侧 originalEditor 会发出一个异步的onScroll，
      // 这个行为可能会带动右侧 modifiedEditor 进行滚动， 导致 revealRange 错位
      // 此处 添加一个 onDidUpdateDiff 监听
      Event.once(this.monacoDiffEditor.onDidUpdateDiff)(() => {
        currentEditor.setSelection(range);
        setTimeout(() => {
          currentEditor.revealRangeInCenter(range);
        });
      });
    }
    this._onRefOpen.fire(originalDocModelRef);
    this._onRefOpen.fire(modifiedDocModelRef);
    const enableHideUnchanged = this.preferenceService.get('diffEditor.hideUnchangedRegions.enabled');

    if (options.revealFirstDiff && !enableHideUnchanged) {
      // 仅在非折叠模式下自动滚动到第一个 Diff
      const diffs = this.monacoDiffEditor.getLineChanges();
      if (diffs && diffs.length > 0) {
        this.showFirstDiff(model);
      } else {
        const disposer = this.monacoDiffEditor.onDidUpdateDiff(() => {
          this.showFirstDiff(model);
          disposer.dispose();
        });
      }
    }
    await this.updateOptionsOnModelChange();
    this.diffResourceKeys.forEach((r) => r.set(this.currentUri));
  }

  private async showFirstDiff(model?: monaco.editor.IDiffEditorViewModel) {
    await model?.waitForDiff();
    this.monacoDiffEditor.revealFirstDiff();
  }

  private async updateOptionsOnModelChange() {
    await this.doUpdateDiffOptions();
  }

  isReadonly(): boolean {
    return !!this.modifiedDocModel?.readonly;
  }

  private async doUpdateDiffOptions() {
    const uriStr = this.modifiedEditor.currentUri ? this.modifiedEditor.currentUri.toString() : undefined;
    const languageId = this.modifiedEditor.currentDocumentModel
      ? this.modifiedEditor.currentDocumentModel.languageId
      : undefined;
    const options = getConvertedMonacoOptions(this.configurationService, uriStr, languageId);
    const readOnly = this.isReadonly();
    this.monacoDiffEditor.updateOptions({
      ...options.diffOptions,
      ...this.specialOptions,
      readOnly,
      renderMarginRevertIcon: !readOnly,
    });
    if (this.currentUri) {
      this.eventBus.fire(
        new ResourceDecorationNeedChangeEvent({
          uri: this.currentUri,
          decoration: {
            readOnly: this.isReadonly(),
          },
        }),
      );
    }
  }

  updateDiffOptions() {
    this.doUpdateDiffOptions();
  }

  getLineChanges(): ILineChange[] | null {
    const diffChanges = this.monacoDiffEditor.getLineChanges();
    if (!diffChanges) {
      return null;
    }
    return diffChanges.map((change) => [
      change.originalStartLineNumber,
      change.originalEndLineNumber,
      change.modifiedStartLineNumber,
      change.modifiedEndLineNumber,
      change.charChanges?.map((charChange) => [
        charChange.originalStartLineNumber,
        charChange.originalStartColumn,
        charChange.originalEndLineNumber,
        charChange.originalEndColumn,
        charChange.modifiedStartLineNumber,
        charChange.modifiedStartColumn,
        charChange.modifiedEndLineNumber,
        charChange.modifiedEndColumn,
      ]),
    ]);
  }

  private wrapEditors() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const diffEditor = this;
    this.originalEditor = this.injector.get(DiffEditorPart, [
      diffEditor.monacoDiffEditor.getOriginalEditor(),
      () => diffEditor.originalDocModel,
      EditorType.ORIGINAL_DIFF,
    ]);

    this.modifiedEditor = this.injector.get(DiffEditorPart, [
      diffEditor.monacoDiffEditor.getModifiedEditor(),
      () => diffEditor.modifiedDocModel,
      EditorType.MODIFIED_DIFF,
    ]);

    this.collectionService.addEditors([this.originalEditor, this.modifiedEditor]);
    this.collectionService.addDiffEditors([this]);

    // 为 modified 和 original editor 的 contextKeyService 注入diffEditor的ResourceKey
    const modifiedContextKeyService = this.contextKeyService.createScoped(
      (this.modifiedEditor.monacoEditor as any)._contextKeyService,
    );
    const originalContextKeyService = this.contextKeyService.createScoped(
      (this.originalEditor.monacoEditor as any)._contextKeyService,
    );
    this.diffResourceKeys = [
      new ResourceContextKey(modifiedContextKeyService, undefined, 'diffResource'),
      new ResourceContextKey(originalContextKeyService, undefined, 'diffResource'),
    ];
  }

  layout(): void {
    return this.monacoDiffEditor.layout();
  }

  focus(): void {
    this.monacoDiffEditor.focus();
  }

  dispose(): void {
    super.dispose();
    this.collectionService.removeEditors([this.originalEditor, this.modifiedEditor]);
    this.collectionService.removeDiffEditors([this]);
    this.monacoDiffEditor.dispose();
    this._disposed = true;
  }
}

// utils
function bindPreventNavigation(div: HTMLElement) {
  div.addEventListener('mousewheel', preventNavigation as any);
}

function preventNavigation(this: HTMLDivElement, e: WheelEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (this.offsetWidth + this.scrollLeft + e.deltaX > this.scrollWidth) {
    e.preventDefault();
    e.stopPropagation();
  } else if (this.scrollLeft + e.deltaX < 0) {
    e.preventDefault();
    e.stopPropagation();
  }
}
