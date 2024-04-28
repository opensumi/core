import { Injector } from '@opensumi/di';
import { MonacoService } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { EditorLayoutInfo, EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IModelDecorationOptions, ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { DetailedLineRangeMapping } from '../../../../../common/diff';
import { MappingManagerService } from '../../mapping-manager.service';
import { IMergeEditorEditorConstructionOptions } from '../../merge-editor-widget';
import { ConflictActions } from '../../model/conflict-actions';
import { MergeEditorDecorations } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import {
  EDiffRangeTurn,
  ETurnDirection,
  EditorViewType,
  IActionsDescription,
  IActionsProvider,
  IBaseCodeEditor,
  IConflictActionsEvent,
  LineRangeType,
} from '../../types';

export abstract class BaseCodeEditor extends Disposable implements IBaseCodeEditor {
  #actionsProvider: IActionsProvider | undefined;
  #conflictActions: ConflictActions;

  public editor: ICodeEditor;

  protected decorations: MergeEditorDecorations;
  protected mappingManagerService: MappingManagerService;

  protected readonly _onDidConflictActions = new Emitter<IConflictActionsEvent>();
  public readonly onDidConflictActions: Event<IConflictActionsEvent> = this._onDidConflictActions.event;

  protected readonly _onDidActionsProvider = new Emitter<{ provider: IActionsProvider; editor: BaseCodeEditor }>();
  public readonly onDidActionsProvider: Event<{ provider: IActionsProvider; editor: BaseCodeEditor }> =
    this._onDidActionsProvider.event;

  constructor(
    protected readonly container: HTMLDivElement,
    protected readonly monacoService: MonacoService,
    protected readonly injector: Injector,
  ) {
    super();
    this.mount();
  }

  public launchConflictActionsEvent(eventData: IConflictActionsEvent): void {
    this._onDidConflictActions.fire(eventData);
  }

  public override dispose(): void {
    super.dispose();
    this.editor.dispose();
    this.decorations.dispose();
    this.#conflictActions.dispose();
  }

  public mount(): void {
    this.editor = this.monacoService.createCodeEditor(this.container);

    this.updateOptions({});

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
    inputRange: LineRange,
  ): Omit<IModelDecorationOptions, 'description'>;

  protected abstract getMonacoEditorOptions(): IStandaloneEditorConstructionOptions;

  public launchChange(): void {
    this.decorations.launchChange();
  }

  /**
   * 在绘制前，计算当前 range 和 innerChanges 是什么类型，如 insert、modify 亦或是 remove
   * @param withBase: 0: origin，1: modify
   */
  protected prepareRenderDecorations(withBase: 0 | 1 = 0): [LineRange[], InnerRange[][]] {
    const [turnLeft, turnRight] =
      withBase === 0
        ? [this.documentMapping.getModifiedRange(), this.documentMapping.getOriginalRange()]
        : [this.documentMapping.getOriginalRange(), this.documentMapping.getModifiedRange()];

    const changesResult: LineRange[] = [];
    const innerChangesResult: InnerRange[][] = [];

    turnLeft.forEach((range, idx) => {
      const oppositeRange = turnRight[idx];
      const _exec = (type: LineRangeType) => {
        const direction = withBase === 1 ? ETurnDirection.CURRENT : ETurnDirection.INCOMING;
        oppositeRange.setType(type).setTurnDirection(oppositeRange.turnDirection ?? direction);
        changesResult.push(range.setType(type).setTurnDirection(range.turnDirection ?? direction));
        // inner range 先不计算
      };

      if (oppositeRange) {
        _exec(
          range.type ??
            (range.isTendencyRight(oppositeRange)
              ? 'remove'
              : range.isTendencyLeft(oppositeRange)
              ? 'insert'
              : 'modify'),
        );
      }
    });

    return [changesResult, innerChangesResult];
  }

  protected abstract provideActionsItems(ranges?: LineRange[]): IActionsDescription[];

  public updateOptions(newOptions: IMergeEditorEditorConstructionOptions): void {
    this.editor.updateOptions({
      ...newOptions,
      // 以下配置优先级更高
      automaticLayout: true,
      wordBasedSuggestions: true,
      renderLineHighlight: 'all',
      folding: false,
      lineNumbersMinChars: 0,
      minimap: {
        enabled: false,
      },
      codeLens: false,
      scrollBeyondLastLine: true,
      ...this.getMonacoEditorOptions(),
    });
  }

  public updateActions(): this {
    this.conflictActions.updateActions(this.provideActionsItems());
    return this;
  }

  public updateDecorations(): this {
    const [r, i] = this.prepareRenderDecorations();
    this.decorations.updateDecorations(r, i);
    return this;
  }

  protected registerActionsProvider(provider: IActionsProvider): void {
    if (this.#actionsProvider) {
      return;
    }

    this.#actionsProvider = provider;
    this._onDidActionsProvider.fire({
      provider,
      editor: this,
    });
  }

  public setConflictActions(actions: IActionsDescription[]): void {
    this.#conflictActions.setActions(actions);
  }

  public get actionsProvider(): IActionsProvider | undefined {
    return this.#actionsProvider;
  }

  public get conflictActions(): ConflictActions {
    return this.#conflictActions;
  }

  public clearActions(range: LineRange): void {
    this.conflictActions.clearActions(range.id);
  }

  public clearDecorations(): void {
    this.decorations.clearDecorations();
  }

  public getUri(): string {
    return this.getModel()?.uri.path.toString()!;
  }

  /**
   * 接受 diff 结果，用于计算 decorations 等
   *
   * @param turnType: 表示 computer diff 的结果是以 origin 作为比较还是 modify 作为比较
   */
  public abstract inputDiffComputingResult(changes: DetailedLineRangeMapping[], turnType?: EDiffRangeTurn): void;
}
