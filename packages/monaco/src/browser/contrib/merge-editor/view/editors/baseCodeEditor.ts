import { Injector } from '@opensumi/di';
import { MonacoService } from '@opensumi/ide-core-browser';
import { Disposable, Event } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { EditorLayoutInfo, EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IModelDecorationOptions, ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { ConflictActions } from '../../model/conflict-actions';
import {
  IDiffDecoration,
  IRenderChangesInput,
  IRenderInnerChangesInput,
  MergeEditorDecorations,
} from '../../model/decorations';
import { LineRange } from '../../model/line-range';
import { EditorViewType, IActionsProvider, IBaseCodeEditor } from '../../types';
import { flatModified, flatOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

export abstract class BaseCodeEditor extends Disposable implements IBaseCodeEditor {
  #actionsProvider: IActionsProvider | undefined;
  #conflictActions: ConflictActions;

  protected decorations: MergeEditorDecorations;
  protected editor: ICodeEditor;

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

  public abstract computeResultRangeMapping: LineRangeMapping[];

  public abstract getEditorViewType(): EditorViewType;

  public abstract getMonacoDecorationOptions(
    inputDecoration: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'>;

  protected abstract getMonacoEditorOptions(): IStandaloneEditorConstructionOptions;

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
    innerChanges: Range[][],
    withBase: 0 | 1 = 0,
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]] {
    const toBeRanges =
      withBase === 0 ? flatOriginal(this.computeResultRangeMapping) : flatModified(this.computeResultRangeMapping);

    const changesResult: IRenderChangesInput[] = [];
    const innerChangesResult: IRenderInnerChangesInput[] = [];

    ranges.forEach((range, idx) => {
      const sameInner = innerChanges[idx];
      if (range.isTendencyRight(toBeRanges[idx])) {
        changesResult.push({ ranges: range, type: 'remove' });
        innerChangesResult.push({ ranges: sameInner, type: 'remove' });
      } else if (range.isTendencyLeft(toBeRanges[idx])) {
        changesResult.push({ ranges: range, type: 'insert' });
        innerChangesResult.push({ ranges: sameInner, type: 'insert' });
      } else {
        changesResult.push({ ranges: range, type: 'modify' });
        innerChangesResult.push({ ranges: sameInner, type: 'modify' });
      }
    });

    return [changesResult, innerChangesResult];
  }

  protected renderDecorations(ranges: LineRange[], innerChanges: Range[][]): void {
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
