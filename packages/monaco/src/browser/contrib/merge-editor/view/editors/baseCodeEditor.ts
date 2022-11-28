import { Injector } from '@opensumi/di';
import { MonacoService } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { EditorLayoutInfo, EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IModelDecorationOptions, ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { ConflictActions } from '../../model/conflict-actions';
import { IDiffDecoration, MergeEditorDecorations } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { MappingManagerService } from '../../service/mapping-manager.service';
import { EditorViewType, IActionsProvider, IBaseCodeEditor, IConflictActionsEvent, LineRangeType } from '../../types';
import { GuidelineWidget } from '../guideline-widget';

export abstract class BaseCodeEditor extends Disposable implements IBaseCodeEditor {
  #actionsProvider: IActionsProvider | undefined;
  #conflictActions: ConflictActions;

  protected decorations: MergeEditorDecorations;
  protected editor: ICodeEditor;
  protected mappingManagerService: MappingManagerService;

  protected readonly _onDidConflictActions = new Emitter<IConflictActionsEvent>();
  public readonly onDidConflictActions: Event<IConflictActionsEvent> = this._onDidConflictActions.event;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly monacoService: MonacoService,
    private readonly injector: Injector,
  ) {
    super();
    this.mount();
  }

  public override dispose(): void {
    super.dispose();
    this.editor.dispose();
    this.decorations.dispose();
    this.#conflictActions.dispose();
  }

  public mount(): void {
    this.editor = this.monacoService.createCodeEditor(this.container, {
      automaticLayout: true,
      wordBasedSuggestions: true,
      renderLineHighlight: 'all',
      folding: false,
      lineNumbersMinChars: 0,
      minimap: {
        enabled: false,
      },
      scrollBeyondLastLine: false,
      ...this.getMonacoEditorOptions(),
    });

    this.decorations = this.injector.get(MergeEditorDecorations, [this, this.getEditorViewType()]);
    this.#conflictActions = this.injector.get(ConflictActions, [this]);
    this.mappingManagerService = this.injector.get(MappingManagerService);

    this.addDispose(
      Event.debounce(
        Event.any<MergeEditorDecorations | EditorLayoutInfo>(
          this.decorations.onDidChangeDecorations,
          this.editor.onDidLayoutChange,
        ),
        () => {},
        0,
      )(() => {
        const lineDecorationsWidth = this.editor.getOption(EditorOption.lineDecorationsWidth);
        const contentLeft = this.editor.getLayoutInfo().contentLeft;
        const marginWidth = contentLeft - (typeof lineDecorationsWidth === 'number' ? lineDecorationsWidth : 0);
        const widgets = this.decorations.getLineWidgets();
        if (widgets.length > 0) {
          widgets.forEach((w) => {
            if (w) {
              w.setContainerStyle({
                left: marginWidth + 'px',
              });
            }
          });
        }
      }),
    );
  }

  public get onDidChangeDecorations(): Event<MergeEditorDecorations> {
    return this.decorations.onDidChangeDecorations;
  }

  public getEditor(): ICodeEditor {
    return this.editor;
  }

  public getModel(): ITextModel | null {
    return this.editor.getModel();
  }

  public abstract documentMapping: DocumentMapping;

  public abstract getEditorViewType(): EditorViewType;

  public abstract getMonacoDecorationOptions(
    inputDecoration: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'>;

  protected abstract getMonacoEditorOptions(): IStandaloneEditorConstructionOptions;

  public abstract updateDecorations(): void;
  public launchChange(): void {
    this.decorations.launchChange();
  }

  /**
   * 每次重新绘制之前要保留哪些 decoration
   */
  protected abstract getRetainDecoration(): IDiffDecoration[];

  /**
   * 每次重新绘制之前要保留哪些 line widget
   */
  protected abstract getRetainLineWidget(): GuidelineWidget[];

  /**
   * 在绘制前，计算当前 range 和 innerChanges 是什么类型，如 insert、modify 亦或是 remove
   * @param withBase: 0: origin，1: modify
   */
  protected prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: InnerRange[][],
    withBase: 0 | 1 = 0,
  ): [LineRange[], InnerRange[][]] {
    const toBeRanges =
      withBase === 0 ? this.documentMapping.getOriginalRange() : this.documentMapping.getModifiedRange();

    const changesResult: LineRange[] = [];
    const innerChangesResult: InnerRange[][] = [];

    ranges.forEach((range, idx) => {
      const sameInner = innerChanges[idx];
      const sameRange = toBeRanges[idx];
      const _exec = (type: LineRangeType) => {
        changesResult.push(range.setType(type));
        innerChangesResult.push(sameInner.map((i) => i.setType(type)));
      };

      _exec(range.isTendencyRight(sameRange) ? 'remove' : range.isTendencyLeft(sameRange) ? 'insert' : 'modify');
    });

    return [changesResult, innerChangesResult];
  }

  protected renderDecorations(ranges: LineRange[], innerChanges: InnerRange[][]): void {
    const [r, i] = this.prepareRenderDecorations(ranges, innerChanges);
    this.decorations
      .setRetainDecoration(this.getRetainDecoration())
      .setRetainLineWidget(this.getRetainLineWidget())
      .updateDecorations(r, i);
  }

  protected registerActionsProvider(provider: IActionsProvider): void {
    if (this.#actionsProvider) {
      return;
    }

    this.#actionsProvider = provider;

    const { provideActionsItems } = provider;
    this.#conflictActions.setActions(provideActionsItems());
  }

  public get actionsProvider(): IActionsProvider | undefined {
    return this.#actionsProvider;
  }

  public get conflictActions(): ConflictActions {
    return this.#conflictActions;
  }

  public clearActions(range: LineRange): void {
    this.conflictActions.clearActions(range.startLineNumber);
  }

  public clearDecorations(): void {
    this.decorations.clearDecorations();
  }

  /**
   * @param diffByDirection
   * 0 表示自己以 originalRange 为基础，与 modifiedRange 作比较
   * 1 与 0 相反
   */
  public abstract inputDiffComputingResult(changes: LineRangeMapping[], baseRange?: 0 | 1): void;
}
