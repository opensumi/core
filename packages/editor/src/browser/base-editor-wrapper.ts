import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { IRange } from '@opensumi/ide-core-browser';
import { Disposable, ISelection, URI, WithEventBus, isEmptyObject, objects } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { ISettableObservable } from '@opensumi/ide-monaco/lib/common/observable';
import { RefCounted } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/diffEditor/utils';
import { IDocumentDiffItem } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/model';
import { IConfigurationService } from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { EditorType, IDecorationApplyOptions, IEditor, IUndoStopOptions } from '../common';
import { IEditorDocumentModel } from '../common/editor';

import { MonacoEditorDecorationApplier } from './decoration-applier';
import { getConvertedMonacoOptions, isEditorOption } from './preference/converter';
import { IEditorFeatureRegistry } from './types';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

export type ISumiEditor = IEditor;

export function insertSnippetWithMonacoEditor(
  editor: IMonacoCodeEditor,
  template: string,
  ranges: IRange[],
  opts: IUndoStopOptions,
) {
  const snippetController = editor.getContribution('snippetController2') as any;
  const selections: ISelection[] = ranges.map(
    (r) => new monaco.Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn),
  );
  editor.setSelections(selections);
  editor.focus();

  snippetController.insert(template, 0, 0, opts.undoStopBefore, opts.undoStopAfter);
}

const { removeUndefined } = objects;

function updateOptionsWithMonacoEditor(
  monacoEditor: IMonacoCodeEditor,
  editorOptions: monaco.editor.IEditorOptions,
  modelOptions: monaco.editor.ITextModelUpdateOptions,
) {
  monacoEditor.updateOptions(editorOptions);
  if (monacoEditor.getModel()) {
    monacoEditor.getModel()!.updateOptions(modelOptions);
  }
}

@Injectable({ multiple: true })
export abstract class BaseMonacoEditorWrapper extends WithEventBus implements IEditor {
  public abstract readonly currentDocumentModel: IEditorDocumentModel | null;

  public get currentUri(): URI | null {
    return this.currentDocumentModel ? this.currentDocumentModel.uri : null;
  }

  public getId() {
    return this.monacoEditor.getId();
  }

  getSelections() {
    return this.monacoEditor.getSelections() || [];
  }

  public onFocus = this.monacoEditor.onDidFocusEditorWidget;

  public onBlur = this.monacoEditor.onDidBlurEditorWidget;

  protected _specialEditorOptions: any = {};

  protected _specialModelOptions: monaco.editor.ITextModelUpdateOptions = {};

  protected _editorOptionsFromContribution: any = {};

  @Autowired(IEditorFeatureRegistry)
  protected readonly editorFeatureRegistry: IEditorFeatureRegistry;

  @Autowired(IConfigurationService)
  protected readonly configurationService: IConfigurationService;

  protected readonly decorationApplier: MonacoEditorDecorationApplier;

  private _disableSelectionEmitter = false;

  protected disableSelectionEmitter() {
    this._disableSelectionEmitter = true;
  }

  protected enableSelectionEmitter() {
    this._disableSelectionEmitter = false;
  }

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  constructor(public readonly monacoEditor: IMonacoCodeEditor, private type: EditorType) {
    super();
    this.decorationApplier = this.injector.get(MonacoEditorDecorationApplier, [this.monacoEditor]);
    this.addDispose(this.monacoEditor.onDidChangeModel(this.onDidChangeModel.bind(this)));
    this.addDispose(
      this.monacoEditor.onDidChangeModelLanguage(() => {
        this._doUpdateOptions();
      }),
    );
    this.addDispose(
      this.configurationService.onDidChangeConfiguration((e) => {
        const changedEditorKeys = Array.from(e.affectedKeys.values()).filter((key) => isEditorOption(key));
        if (changedEditorKeys.length > 0) {
          this._doUpdateOptions();
        }
      }),
    );
  }

  private async onDidChangeModel() {
    this._editorOptionsFromContribution = {};
    const uri = this.currentUri;
    if (uri) {
      Promise.resolve(this.editorFeatureRegistry.runProvideEditorOptionsForUri(uri)).then((options) => {
        if (!this.currentUri || !uri.isEqual(this.currentUri)) {
          return; // uri可能已经变了
        }

        if (options && Object.keys(options).length > 0) {
          this._editorOptionsFromContribution = options;
          if (!isEmptyObject(this._editorOptionsFromContribution)) {
            this._doUpdateOptions();
          }
        }
      });
    }
  }

  public getType() {
    return this.type;
  }

  updateOptions(
    editorOptions: monaco.editor.IEditorOptions = {},
    modelOptions: monaco.editor.ITextModelUpdateOptions = {},
  ) {
    this._specialEditorOptions = removeUndefined({ ...this._specialEditorOptions, ...editorOptions });
    this._specialModelOptions = removeUndefined({ ...this._specialModelOptions, ...modelOptions });
    this._doUpdateOptions();
  }

  private _doUpdateOptions() {
    const { editorOptions, modelOptions } = this._calculateFinalOptions();
    updateOptionsWithMonacoEditor(this.monacoEditor, editorOptions, modelOptions);
  }

  /**
   * 合并所有的选项
   * 优先关系: （从高到底）
   * 1. 当前编辑器的特殊选项（通过调用 updateOptions或者启动时传入）
   * 2. 来自 featureRegistry 的根据 当前uri 提供的选项
   * 3. 来自偏好设置的选项
   */
  private _calculateFinalOptions() {
    const uriStr = this.currentUri ? this.currentUri.toString() : undefined;
    const languageId = this.currentDocumentModel ? this.currentDocumentModel.languageId : undefined;
    const options = getConvertedMonacoOptions(this.configurationService, uriStr, languageId, undefined);
    const basicEditorOptions: Partial<monaco.editor.IEditorOptions> = {
      readOnly: this.currentDocumentModel?.readonly || false,
    };

    let editorOptions = {
      ...basicEditorOptions,
      ...options.editorOptions,
      ...this._editorOptionsFromContribution,
      ...this._specialEditorOptions,
    };

    if (this.type !== EditorType.CODE) {
      editorOptions = {
        ...editorOptions,
        ...options.diffOptions,
      };
    }

    return {
      editorOptions,
      modelOptions: { ...options.modelOptions, ...this._specialModelOptions },
    };
  }

  insertSnippet(template: string, ranges: IRange[], opts: IUndoStopOptions) {
    insertSnippetWithMonacoEditor(this.monacoEditor, template, ranges, opts);
  }

  applyDecoration(key: string, options: IDecorationApplyOptions[]) {
    this.decorationApplier.applyDecoration(key, options);
  }

  onSelectionsChanged(listener) {
    return this.monacoEditor.onDidChangeCursorSelection((e) => {
      if (!this._disableSelectionEmitter) {
        listener({
          selections: this.getSelections(),
          source: e.source,
        });
      }
    });
  }

  onVisibleRangesChanged(listener) {
    const disposer = new Disposable();
    const monacoEditor = this.monacoEditor;
    disposer.addDispose(
      monacoEditor.onDidScrollChange((e) => {
        listener(this.monacoEditor.getVisibleRanges());
      }),
    );
    disposer.addDispose(
      monacoEditor.onDidLayoutChange((e) => {
        listener(this.monacoEditor.getVisibleRanges());
      }),
    );
    return disposer;
  }

  setSelections(selections) {
    return this.monacoEditor.setSelections(selections as any);
  }

  setSelection(selection) {
    return this.monacoEditor.setSelection(selection as any);
  }

  public async save(): Promise<void> {
    if (this.currentDocumentModel) {
      await this.currentDocumentModel.save();
    }
  }

  onConfigurationChanged(listener) {
    const monacoEditor = this.monacoEditor;
    return monacoEditor.onDidChangeConfiguration((e) => {
      listener();
    });
  }
}
@Injectable({ multiple: true })
export class DiffEditorPart extends BaseMonacoEditorWrapper implements IEditor {
  get currentDocumentModel() {
    return this._getDocumentModel();
  }

  public updateDocumentModel(uri: URI) {
    const document = this.documents.get();
    if (document === 'loading') {
      return;
    }
    for (const item of document) {
      if (item.object.modified) {
        if (URI.from(item.object.modified.uri).isEqual(uri)) {
          this._getDocumentModel = () => (item.object as any).modifiedInstance;
        }
      }
      if (item.object.original) {
        if (URI.from(item.object.original.uri).isEqual(uri)) {
          this._getDocumentModel = () => (item.object as any).originalInstance;
        }
      }
    }
  }

  constructor(
    monacoEditor: IMonacoCodeEditor,
    public _getDocumentModel: () => IEditorDocumentModel | null,
    type: EditorType,
    private documents: ISettableObservable<readonly RefCounted<IDocumentDiffItem>[] | 'loading', void>,
  ) {
    super(monacoEditor, type);
  }
}
