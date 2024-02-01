import debounce from 'lodash/debounce';

import { Autowired, Injectable, Injector, Optional } from '@opensumi/di';
import {
  AiNativeConfigService,
  CancellationToken,
  CancellationTokenSource,
  ConstructorOf,
  Emitter,
  Event,
  MonacoService,
  runWhenIdle,
} from '@opensumi/ide-core-browser';
import { MergeConflictReportService } from '@opensumi/ide-core-browser/lib/ai-native/conflict-report.service';
import { AiBackSerivcePath, IAiBackService, IAiBackServiceResponse } from '@opensumi/ide-core-common/lib/ai-native';
import { distinct } from '@opensumi/monaco-editor-core/esm/vs/base/common/arrays';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import {
  IModelDecorationOptions,
  IModelDeltaDecoration,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import {
  FormattingMode,
  formatDocumentRangesWithSelectedProvider,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { IInstantiationService } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/instantiation';
import { Progress } from '@opensumi/monaco-editor-core/esm/vs/platform/progress/common/progress';

import { BaseInlineContentWidget } from '../../../../ai-native/content-widget';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { IIntelligentState, LineRange } from '../../model/line-range';
import { TimeMachineDocument } from '../../model/time-machine';
import {
  ACCEPT_COMBINATION_ACTIONS,
  ADDRESSING_TAG_CLASSNAME,
  AI_RESOLVE_ACTIONS,
  AI_RESOLVE_REGENERATE_ACTIONS,
  CONFLICT_ACTIONS_ICON,
  DECORATIONS_CLASSNAME,
  ETurnDirection,
  EditorViewType,
  IActionsDescription,
  IConflictActionsEvent,
  ITimeMachineMetaData,
  REVOKE_ACTIONS,
  TActionsType,
} from '../../types';
import { ResolveResultWidget } from '../../widget/resolve-result-widget';
import { StopWidget } from '../../widget/stop-widget';

import { BaseCodeEditor } from './baseCodeEditor';

interface IWidgetFactory {
  hideWidget(id?: string): void;
  addWidget(range: LineRange): void;
  hasWidget(range: LineRange): boolean;
}

class WidgetFactory implements IWidgetFactory {
  private widgetMap: Map<string, BaseInlineContentWidget>;

  constructor(
    private contentWidget: ConstructorOf<BaseInlineContentWidget>,
    private editor: BaseCodeEditor,
    private injector: Injector,
  ) {
    this.widgetMap = new Map();
  }

  hasWidget(range: LineRange): boolean {
    return this.widgetMap.get(range.id) !== undefined;
  }

  public hideWidget(id?: string): void {
    if (id) {
      const widget = this.widgetMap.get(id);
      if (widget) {
        widget.hide();
        this.widgetMap.delete(id);
      }
      return;
    }

    this.widgetMap.forEach((widget) => {
      widget.hide();
    });
    this.widgetMap.clear();
  }

  public addWidget(range: LineRange): void {
    const id = range.id;
    if (this.widgetMap.has(id)) {
      return;
    }

    const position = new Position(Math.max(range.startLineNumber, range.endLineNumberExclusive - 1), 1);

    const widget = this.injector.get(this.contentWidget, [this.editor, range]);
    widget.show({ position });

    this.widgetMap.set(id, widget);
  }
}

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(MergeConflictReportService)
  private readonly mergeConflictReportService: MergeConflictReportService;

  private readonly _onDidChangeContent = new Emitter<void>();
  public readonly onDidChangeContent: Event<void> = this._onDidChangeContent.event;

  private readonly _onChangeRangeIntelligentState = new Emitter<LineRange>();
  public readonly onChangeRangeIntelligentState: Event<LineRange> = this._onChangeRangeIntelligentState.event;

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { lineNumbersMinChars: 2, lineDecorationsWidth: 24 };
  }

  private timeMachineDocument: TimeMachineDocument;
  private resolveResultWidgetManager: IWidgetFactory;
  private stopWidgetManager: IWidgetFactory;
  private isFirstInputComputeDiff = true;
  private cancelIndicatorMap: Map<string, CancellationTokenSource> = new Map();

  protected aiBackService: IAiBackService;

  /** @deprecated */
  public documentMapping: DocumentMapping;

  private get documentMappingTurnLeft(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnLeft;
  }
  private get documentMappingTurnRight(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnRight;
  }

  constructor(
    container: HTMLDivElement,
    monacoService: MonacoService,
    injector: Injector,
    @Optional() relationId: string,
  ) {
    super(container, monacoService, injector, relationId);
    this.timeMachineDocument = injector.get(TimeMachineDocument, []);
    this.initListenEvent();

    this.resolveResultWidgetManager = new WidgetFactory(ResolveResultWidget, this, this.injector);
    this.stopWidgetManager = new WidgetFactory(StopWidget, this, this.injector);

    if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      this.aiBackService = injector.get(AiBackSerivcePath);
    }
  }

  public hideResolveResultWidget(id?: string) {
    this.resolveResultWidgetManager.hideWidget(id);
  }

  public hideStopWidget(id?: string) {
    this.stopWidgetManager.hideWidget(id);
  }

  public renderSkeletonDecoration(range: LineRange, classNames: string[]): () => void {
    const renderSkeletonDecoration = (className: string): IModelDeltaDecoration => ({
      range: InnerRange.fromPositions(
        new Position(range.startLineNumber, 1),
        new Position(Math.max(range.startLineNumber, range.endLineNumberExclusive - 1), 1),
      ),
      options: {
        isWholeLine: true,
        description: 'skeleton',
        className,
      },
    });

    const preDecorationsIds = this.getModel()!.deltaDecorations(
      [],
      classNames.map((cls) => renderSkeletonDecoration(cls)),
    );

    return () => {
      this.getModel()!.deltaDecorations(preDecorationsIds, []);
    };
  }

  public async requestAiResolveConflict(
    codePromptBean: string,
    range: LineRange,
    isRegenerate = false,
  ): Promise<IAiBackServiceResponse | undefined> {
    if (this.aiBackService) {
      let prompt = `你是一个智能解决代码冲突的专家，我遇到了一个代码的冲突，请仔细思考后给我解决冲突后最匹配的一个结果。注意，你需要理解代码语义后再给出答案。以下是代码中的冲突部分: \n ${codePromptBean}`;

      if (isRegenerate) {
        const newContent = this.getModel()!.getValueInRange(range.toRange());
        prompt += `\n当前的解决冲突后的代码是 \n ${newContent}，但是我不够满意，希望给出另一种解决方案`;
      }

      return this.aiBackService.request(prompt, { type: 'resolveConflict' }, this.createRequestToken(range.id).token);
    }

    return;
  }

  // 生成 cancel token
  public createRequestToken(id: string): CancellationTokenSource {
    const token = new CancellationTokenSource();
    this.cancelIndicatorMap.set(id, token);
    return token;
  }

  public cancelRequestToken(id?: string) {
    if (id) {
      if (!this.cancelIndicatorMap.has(id)) {
        return;
      }

      const token = this.cancelIndicatorMap.get(id);
      token?.cancel();
      return;
    }

    this.cancelIndicatorMap.forEach((token) => {
      token.cancel();
    });
    this.cancelIndicatorMap.clear();
  }

  /**
   * @param isFull 是否全量更新
   */
  public changeRangeIntelligentState(range: LineRange, state: Partial<IIntelligentState>, isFull = true): void {
    const intelligentModel = range.getIntelligentStateModel();
    intelligentModel.setAll(state, isFull);
    this._onChangeRangeIntelligentState.fire(range);
  }

  /**
   * 根据 id 获取最新的 range 数据
   */
  public getFlushRange(range: LineRange): LineRange | undefined {
    const id = range.id;
    const allRanges = this.getAllDiffRanges();
    return allRanges.find((range) => range.id === id);
  }

  public async formatDocument(range: LineRange): Promise<void> {
    const scrollPosition = {
      scrollTop: this.editor.getScrollTop(),
      scrollLeft: this.editor.getScrollLeft(),
    };

    const instaService = StandaloneServices.get(IInstantiationService);
    // monaco 内部的 format 无法通过 command 或 api 来指定 range，所以这里需要像这样调用，手动传入 range
    await instaService.invokeFunction(
      formatDocumentRangesWithSelectedProvider,
      this.editor as any,
      range.toInclusiveRange() as monaco.Range,
      FormattingMode.Explicit,
      Progress.None,
      CancellationToken.None,
    );
    runWhenIdle(() => {
      this.editor.setScrollPosition(scrollPosition);
    });
  }

  private initListenEvent(): void {
    let preLineCount = 0;

    this.addDispose(
      this.editor.onDidChangeModel(() => {
        const model = this.editor.getModel();
        if (model) {
          preLineCount = model.getLineCount();
        }
        this.hideResolveResultWidget();
      }),
    );

    if (this.aiNativeConfigService.capabilities.supportsConflictResolve) {
      this.addDispose(
        this.editor.onMouseMove(
          debounce((event: monaco.editor.IEditorMouseEvent) => {
            const { target } = event;

            if (target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS) {
              this.hideResolveResultWidget();
              return;
            }

            const mousePosition = target.position;
            if (!mousePosition) {
              return;
            }

            const allRanges = this.getAllDiffRanges();
            const toLineRange = LineRange.fromPositions(mousePosition.lineNumber);

            const isTouches = allRanges.some((range) => range.isTouches(toLineRange));

            if (isTouches) {
              const targetInRange = allRanges.find((range) => range.isTouches(toLineRange));

              if (!targetInRange) {
                return;
              }

              const intelligentStateModel = targetInRange.getIntelligentStateModel();

              if (intelligentStateModel.isComplete) {
                this.resolveResultWidgetManager.addWidget(targetInRange);
              } else {
                this.hideResolveResultWidget(targetInRange.id);
              }
            } else {
              this.hideResolveResultWidget();
            }
          }, 10),
        ),
      );
    }

    this.addDispose(
      this.editor.onDidChangeModelContent(async (e) => {
        const model = this.editor.getModel();
        if (model && model.getLineCount() !== preLineCount) {
          preLineCount = model.getLineCount();

          const { changes, eol } = e;

          const deltaEdits: Array<{ startLineNumber: number; endLineNumber: number; offset: number }> = [];

          changes.forEach((change) => {
            const { text, range } = change;
            const textLineCount = (text.match(new RegExp(eol, 'ig')) ?? []).length;
            const { startLineNumber, endLineNumber } = range;

            /**
             * startLineNumber 与 endLineNumber 的差值表示选区选了多少行
             * textLineCount 则表示文本出现的换行符数量
             * 两者相加就得出此次文本变更最终新增或减少了多少行
             */
            const offset = startLineNumber - endLineNumber + textLineCount;
            if (offset === 0) {
              return;
            }

            deltaEdits.push({
              startLineNumber,
              endLineNumber,
              offset,
            });
          });

          deltaEdits.forEach((edits) => {
            const { startLineNumber, endLineNumber, offset } = edits;

            const toLineRange = LineRange.fromPositions(startLineNumber, endLineNumber + Math.max(0, offset));
            const { [EditorViewType.CURRENT]: includeLeftRange, [EditorViewType.INCOMING]: includeRightRange } =
              this.mappingManagerService.findIncludeRanges(toLineRange);
            /**
             * 这里需要处理 touch 的情况（也就是 toLineRange 与 documentMapping 里的某一个 lineRange 有重叠的部分）
             * 那么就要以当前 touch range 的结果作为要 delta 的起点
             */
            const { [EditorViewType.CURRENT]: touchTurnLeftRange, [EditorViewType.INCOMING]: touchTurnRightRange } =
              this.mappingManagerService.findTouchesRanges(toLineRange);
            const { [EditorViewType.CURRENT]: nextTurnLeftRange, [EditorViewType.INCOMING]: nextTurnRightRange } =
              this.mappingManagerService.findNextLineRanges(toLineRange);

            if (includeLeftRange) {
              this.documentMappingTurnLeft.deltaEndAdjacentQueue(includeLeftRange, offset);
            } else if (touchTurnLeftRange) {
              this.documentMappingTurnLeft.deltaEndAdjacentQueue(touchTurnLeftRange, offset);
            } else if (nextTurnLeftRange) {
              const reverse = this.documentMappingTurnLeft.reverse(nextTurnLeftRange);
              if (reverse) {
                this.documentMappingTurnLeft.deltaAdjacentQueueAfter(reverse, offset, true);
              }
            }

            if (includeRightRange) {
              this.documentMappingTurnRight.deltaEndAdjacentQueue(includeRightRange, offset);
            } else if (touchTurnRightRange) {
              this.documentMappingTurnRight.deltaEndAdjacentQueue(touchTurnRightRange, offset);
            } else if (nextTurnRightRange) {
              const reverse = this.documentMappingTurnRight.reverse(nextTurnRightRange);
              if (reverse) {
                this.documentMappingTurnRight.deltaAdjacentQueueAfter(reverse, offset, true);
              }
            }
          });

          this._onDidChangeContent.fire();
        }
      }),
    );
  }

  public getAllDiffRanges(): LineRange[] {
    // 去重相同 id 或位置一样的 line range
    return distinct(
      this.documentMappingTurnLeft.getModifiedRange().concat(this.documentMappingTurnRight.getOriginalRange()),
      (range) => range.id,
    );
  }

  protected provideActionsItems(ranges?: LineRange[]): IActionsDescription[] {
    if (!Array.isArray(ranges)) {
      return [];
    }

    const renderIconClassName = (range: LineRange) => {
      const isAiConflictResolve = this.aiNativeConfigService?.capabilities?.supportsConflictResolve;

      if (range.isComplete) {
        return CONFLICT_ACTIONS_ICON.REVOKE;
      }

      if (isAiConflictResolve && range.type === 'modify') {
        const aiModel = range.getIntelligentStateModel();

        if (aiModel.isLoading) {
          return CONFLICT_ACTIONS_ICON.AI_RESOLVE_LOADING;
        }

        if (aiModel.isComplete) {
          return CONFLICT_ACTIONS_ICON.REVOKE;
        }

        if (range.isMerge) {
          return CONFLICT_ACTIONS_ICON.AI_RESOLVE;
        }
      }

      if (range.isAllowCombination && range.isMerge) {
        return CONFLICT_ACTIONS_ICON.WAND;
      }

      return '';
    };

    return ranges.map((range) => ({
      range,
      decorationOptions: {
        firstLineDecorationClassName: DECORATIONS_CLASSNAME.combine(
          renderIconClassName(range),
          `${ADDRESSING_TAG_CLASSNAME}${range.id}`,
        ),
      },
    }));
  }

  /**
   * 提取需要合并的 diff range 区域列表
   */
  private distillNeedMergeRanges(diffRanges: LineRange[]): {
    rawRanges: LineRange[];
    mergeRange: LineRange;
  }[] {
    const result: Map<number, { rawRanges: LineRange[]; mergeRange: LineRange }> = new Map();
    const length = diffRanges.length;
    let slow = 0;
    let mergeRange: LineRange | undefined;

    /** Two Pointers 算法 */
    for (let fast = 0; fast < length; fast++) {
      const slowRange = diffRanges[slow];
      const fastRange = diffRanges[fast];

      if (slowRange.id === fastRange.id) {
        continue;
      }

      // 说明上一次循环已经找到有接触的 range，则以该 mergeRange 作为是否 touch 的比较
      if (mergeRange) {
        if (mergeRange.isTouches(fastRange)) {
          mergeRange = mergeRange.merge(fastRange);
          result.set(slow, { rawRanges: (result.get(slow)?.rawRanges || []).concat(fastRange), mergeRange });
          continue;
        } else {
          // 重置
          mergeRange = undefined;
          slow = fast;
        }
      } else if (slowRange.isTouches(fastRange)) {
        // 如果 range 有接触，则需要合并在一起，同时 slow 指针位置不变
        mergeRange = slowRange.merge(fastRange);
        result.set(slow, { rawRanges: [slowRange, fastRange], mergeRange });
        continue;
      }

      slow += 1;
    }

    return Array.from(result.values());
  }

  private handleNeedMergeRanges(
    needMergeRanges: {
      rawRanges: LineRange[];
      mergeRange: LineRange;
    }[],
  ): void {
    const pickMapping = (range: LineRange) =>
      range.turnDirection === ETurnDirection.CURRENT ? this.documentMappingTurnLeft : this.documentMappingTurnRight;

    for (let { rawRanges, mergeRange } of needMergeRanges) {
      // 需要合并的 range 一定多于两个
      const length = rawRanges.length;
      if (length <= 1) {
        continue;
      }

      // 将 rawRanges 按照 startLineNumber 从小到大排序，如果 startLineNumber 相同，则按照 endLineNumberExclusive 从小到大排序。保证 merge 的 range 是合理的
      rawRanges = rawRanges.sort((a, b) => {
        if (a.startLineNumber === b.startLineNumber) {
          return a.endLineNumberExclusive - b.endLineNumberExclusive;
        }
        return a.startLineNumber - b.startLineNumber;
      });

      /**
       * 取第二个 range 和倒数第二个 range，来对齐最终要合并的 range 的高度
       * 举个例子:
       * 比如有三个 lineRange，位置分别是
       *  1. { startLine: 10，endLine: 20 } // 方向向右
       *  2. { startLine: 20，endLine: 30 } // 方向向左
       *  3. { startLine: 30，endLine: 40 } // 方向向右
       *
       * 首先这三者的 turn directio 方向一定是左右交替的
       * 那么第二个 lineRange 的对位关系 oppositeLineRange 的起点 startLine 就一定会比第一个 lineRange 的起点 startLine 少一个高度
       * 这个高度的差距会影响后续所有的 conflict action 操作（因为缺失的这部分高度会导致 accept 操作后的代码内容丢失）
       *
       * 而我们只需要补齐这第二个和倒数第二个的高度即可，中间部分的所有 lineRange 都会在最终合并到一起
       */
      const secondRange = rawRanges[1];
      const secondLastRange = rawRanges[length - 2];

      let mergeRangeTurnLeft: LineRange | undefined;
      let mergeRangeTurnRight: LineRange | undefined;

      for (const range of rawRanges) {
        const mapping = pickMapping(range);
        const rawReverse = mapping.reverse(range);

        let reverse = rawReverse;
        if (!reverse) {
          continue;
        }

        if (range.id === secondRange.id) {
          // start 要补齐的差值不会是正数
          reverse = reverse
            .deltaStart(Math.min(0, rawRanges[0].startLineNumber - secondRange.startLineNumber))
            .deltaEnd(
              Math.max(0, secondLastRange.endLineNumberExclusive - rawRanges[length - 1].endLineNumberExclusive),
            );
        }

        if (range.id === secondLastRange.id) {
          // end 要补齐的差值不会是负数
          reverse = reverse.deltaEnd(
            Math.max(0, rawRanges[length - 1].endLineNumberExclusive - secondLastRange.endLineNumberExclusive),
          );
        }

        /**
         * 调用 merge 函数的时候不要把 reverse 记录到 mergeStateModel 元数据中，需要记录的是 rawReverse
         * 保证合并前的元数据信息不会被外部改变（比如 deltaStart 或 deltaEnd）
         */
        if (range.turnDirection === ETurnDirection.CURRENT) {
          mergeRangeTurnLeft = (
            !mergeRangeTurnLeft ? reverse : mergeRangeTurnLeft.merge(reverse, false)
          ).recordMergeRange(rawReverse!);
        }

        if (range.turnDirection === ETurnDirection.INCOMING) {
          mergeRangeTurnRight = (
            !mergeRangeTurnRight ? reverse : mergeRangeTurnRight.merge(reverse, false)
          ).recordMergeRange(rawReverse!);
        }

        mapping.deleteRange(reverse);
      }

      if (mergeRangeTurnLeft) {
        const newLineRange = mergeRangeTurnLeft.setTurnDirection(ETurnDirection.CURRENT).setType('modify');
        this.documentMappingTurnLeft.addRange(newLineRange, mergeRange);
      }

      if (mergeRangeTurnRight) {
        const newLineRange = mergeRangeTurnRight.setTurnDirection(ETurnDirection.INCOMING).setType('modify');
        this.documentMappingTurnRight.addRange(newLineRange, mergeRange);
      }
    }
  }

  protected override prepareRenderDecorations(): [LineRange[], InnerRange[][]] {
    const diffRanges: LineRange[] = this.getAllDiffRanges().sort((a, b) => a.startLineNumber - b.startLineNumber);
    const innerChangesResult: InnerRange[][] = [];

    let maybeNeedMergeRanges: {
      rawRanges: LineRange[];
      mergeRange: LineRange;
    }[] = [];

    if (this.isFirstInputComputeDiff) {
      maybeNeedMergeRanges = this.distillNeedMergeRanges(diffRanges);
      this.handleNeedMergeRanges(maybeNeedMergeRanges);
      this.isFirstInputComputeDiff = false;
    }

    /**
     * 如果 maybeNeedMergeRanges 大于 0，说明数据源 document mapping 的对应关系被改变
     * 则需要重新获取一次
     */
    const changesResult: LineRange[] = maybeNeedMergeRanges.length > 0 ? this.getAllDiffRanges() : diffRanges;

    const isAiConflictResolve = this.aiNativeConfigService?.capabilities?.supportsConflictResolve;
    if (isAiConflictResolve) {
      changesResult
        .filter((range) => range.isAiConflictPoint)
        .forEach((range) => {
          const model = range.getIntelligentStateModel();

          this.hideStopWidget(range.id);

          if (model.isLoading) {
            this.stopWidgetManager.addWidget(range);
          }
        });
    }
    return [changesResult, innerChangesResult];
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
    range: LineRange,
  ): Omit<IModelDecorationOptions, 'description'> {
    const isAiComplete = () => {
      const isAiConflictResolve = this.aiNativeConfigService?.capabilities?.supportsConflictResolve;
      const intelligentModel = range.getIntelligentStateModel();

      if (isAiConflictResolve && intelligentModel.isComplete && !intelligentModel.isLoading) {
        return true;
      }

      return false;
    };

    return {
      linesDecorationsClassName: DECORATIONS_CLASSNAME.combine(
        preDecorations.className || '',
        DECORATIONS_CLASSNAME.stretch_right,
        isAiComplete() ? DECORATIONS_CLASSNAME.ai_resolve_complete_lines_decorations : '',
        range.turnDirection === ETurnDirection.CURRENT || range.turnDirection === ETurnDirection.BOTH
          ? DECORATIONS_CLASSNAME.stretch_left
          : '',
      ),
      className: DECORATIONS_CLASSNAME.combine(
        preDecorations.className || '',
        isAiComplete() ? DECORATIONS_CLASSNAME.ai_resolve_complete : '',
        range.turnDirection === ETurnDirection.CURRENT
          ? DECORATIONS_CLASSNAME.stretch_left
          : DECORATIONS_CLASSNAME.combine(DECORATIONS_CLASSNAME.stretch_left, DECORATIONS_CLASSNAME.stretch_right),
      ),
    };
  }

  public reset(): void {
    this.isFirstInputComputeDiff = true;
  }

  public getEditorViewType(): EditorViewType {
    return EditorViewType.RESULT;
  }

  public override updateActions(): this {
    this.conflictActions.updateActions(this.provideActionsItems(this.getAllDiffRanges()));
    return this;
  }

  public getContentInTimeMachineDocument(rangeId: string): ITimeMachineMetaData | undefined {
    return this.timeMachineDocument.getMetaData(rangeId);
  }

  public completeSituation(): { completeCount: number; shouldCount: number } {
    const allRanges = this.getAllDiffRanges();
    let completeCount = 0;

    for (const range of allRanges) {
      if (range.isComplete) {
        completeCount += 1;
      } else if (range.getIntelligentStateModel().isComplete) {
        completeCount += 1;
      }
    }

    return {
      completeCount,
      shouldCount: allRanges.length,
    };
  }

  public override launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void {
    const { range, action } = eventData;
    super.launchConflictActionsEvent({
      range,
      action,
      withViewType: EditorViewType.RESULT,
    });
  }

  /**
   * 由于 compute diff 的源数据都由 document mapping 来处理，所以 result 视图不用单独计算 compute 计算出的 diff changes
   */
  public inputDiffComputingResult(): void {
    this.updateDecorations();
    const diffRanges = this.getAllDiffRanges();

    this.registerActionsProvider({
      provideActionsItems: () => this.provideActionsItems(diffRanges),
      onActionsClick: (range: LineRange, actionType: TActionsType) => {
        if (
          actionType === REVOKE_ACTIONS ||
          actionType === ACCEPT_COMBINATION_ACTIONS ||
          actionType === AI_RESOLVE_ACTIONS ||
          actionType === AI_RESOLVE_REGENERATE_ACTIONS
        ) {
          this.launchConflictActionsEvent({
            range,
            action: actionType,
          });
        }

        if (actionType === AI_RESOLVE_ACTIONS || actionType === AI_RESOLVE_REGENERATE_ACTIONS) {
          this.mergeConflictReportService.reportClickNum(this.relationId);
        }
      },
    });

    diffRanges.forEach((range) => {
      this.timeMachineDocument.record(range.id, {
        range,
        text: range.isEmpty ? null : this.editor.getModel()!.getValueInRange(range.toInclusiveRange()),
      });
    });

    runWhenIdle(() => {
      const aiConflictNum = diffRanges.reduce((pre, cur) => (cur.isAiConflictPoint ? pre + 1 : pre), 0);
      this.mergeConflictReportService.reportPoint(this.relationId, { conflictPointNum: aiConflictNum });
    });
  }
}
