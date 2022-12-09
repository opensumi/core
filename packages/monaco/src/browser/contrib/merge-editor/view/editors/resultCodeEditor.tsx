import { Injectable, Injector } from '@opensumi/di';
import { Emitter, Event, MonacoService } from '@opensumi/ide-core-browser';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { TimeMachineDocument } from '../../model/time-machine';
import {
  EditorViewType,
  DECORATIONS_CLASSNAME,
  TActionsType,
  ADDRESSING_TAG_CLASSNAME,
  CONFLICT_ACTIONS_ICON,
  EDiffRangeTurn,
  IActionsDescription,
  REVOKE_ACTIONS,
  ITimeMachineMetaData,
} from '../../types';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  private readonly _onDidChangeContent = new Emitter<void>();
  public readonly onDidChangeContent: Event<void> = this._onDidChangeContent.event;

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { lineNumbersMinChars: 2, lineDecorationsWidth: 24 };
  }

  private timeMachineDocument: TimeMachineDocument;

  /** @deprecated */
  public documentMapping: DocumentMapping;

  private get documentMappingTurnLeft(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnLeft;
  }
  private get documentMappingTurnRight(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnRight;
  }

  constructor(container: HTMLDivElement, monacoService: MonacoService, injector: Injector) {
    super(container, monacoService, injector);
    this.timeMachineDocument = injector.get(TimeMachineDocument, []);
    this.initListenEvent();
  }

  private initListenEvent(): void {
    let preLineCount = 0;

    this.addDispose(
      this.editor.onDidChangeModel(() => {
        const model = this.editor.getModel();
        if (model) {
          preLineCount = model.getLineCount();
        }
      }),
    );

    this.addDispose(
      this.editor.onDidChangeModelContent((e) => {
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

            const toLineRange = LineRange.fromPositions(startLineNumber, endLineNumber);
            const { [EditorViewType.CURRENT]: includeLeftRange, [EditorViewType.INCOMING]: includeRightRange } =
              this.mappingManagerService.findIncludeRanges(toLineRange);
            /**
             * 这里需要处理 touch 的情况（也就是 toLineRange 与 documentMapping 里的某一个 lineRange 有重叠的部分）
             * 那么就要以当前 touch range 的结果作为要 delta 的起点
             */
            const { [EditorViewType.CURRENT]: touchLeftRanges, [EditorViewType.INCOMING]: touchRightRanges } =
              this.mappingManagerService.findTouchesRanges(toLineRange);
            const { [EditorViewType.CURRENT]: nextLeftRanges, [EditorViewType.INCOMING]: nextRightRanges } =
              this.mappingManagerService.findNextLineRanges(toLineRange);

            if (includeLeftRange) {
              this.documentMappingTurnLeft.deltaEndAdjacentQueue(includeLeftRange, offset);
            } else if (touchLeftRanges && !toLineRange.isAfter(touchLeftRanges)) {
              this.documentMappingTurnLeft.deltaEndAdjacentQueue(touchLeftRanges, offset);
            } else if (nextLeftRanges) {
              const reverse = this.documentMappingTurnLeft.reverse(nextLeftRanges);
              if (reverse) {
                this.documentMappingTurnLeft.deltaAdjacentQueueAfter(reverse, offset, true);
              }
            }

            if (includeRightRange) {
              this.documentMappingTurnRight.deltaEndAdjacentQueue(includeRightRange, offset);
            } else if (touchRightRanges && !toLineRange.isAfter(touchRightRanges)) {
              this.documentMappingTurnRight.deltaEndAdjacentQueue(touchRightRanges, offset);
            } else if (nextRightRanges) {
              const reverse = this.documentMappingTurnRight.reverse(nextRightRanges);
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

  private getAllDiffRanges(): LineRange[] {
    return this.documentMappingTurnLeft.getModifiedRange().concat(this.documentMappingTurnRight.getOriginalRange());
  }

  private provideActionsItems(ranges: LineRange[]): IActionsDescription[] {
    return ranges
      .filter((r) => r.isComplete)
      .map((range) => ({
        range,
        decorationOptions: {
          firstLineDecorationClassName: CONFLICT_ACTIONS_ICON.REVOKE + ` ${ADDRESSING_TAG_CLASSNAME}${range.id}`,
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
    for (const { rawRanges, mergeRange } of needMergeRanges) {
      // 需要合并的 range 一定多于两个
      const length = rawRanges.length;
      if (length <= 1) {
        continue;
      }

      /**
       * 取第二个 range 和倒数第二个 range，来对齐最终要合并的 range 的高度
       * 举个例子:
       * 比如有三个 lineRange，位置分别是
       *  1. { startLine: 10，endLine: 20 } // 方向向右
       *  2. { startLine: 20，endLine: 30 } // 方向向左
       *  3. { startLine: 30，endLine: 40 } // 方向向右
       *
       * 首先这三者的 turn directio 方向一定是左右交替的
       * 那么第二个 lineRange 的对位关系 sameLineRange 的起点 startLine 就一定会比第一个 lineRange 的起点 startLine 少一个高度
       * 这个高度的差距会影响后续所有的 conflict action 操作（因为缺失的这部分高度会导致 accept 操作后的代码内容丢失）
       *
       * 而我们只需要补齐这第二个和倒数第二个的高度即可，中间部分的所有 lineRange 都会在最终合并到一起
       */
      const secondRange = rawRanges[1];
      const secondLastRange = rawRanges[length - 2];

      let mergeRangeTurnLeft: LineRange | undefined;
      let mergeRangeTurnRight: LineRange | undefined;

      for (const range of rawRanges) {
        const mapping =
          range.turnDirection === EditorViewType.CURRENT ? this.documentMappingTurnLeft : this.documentMappingTurnRight;
        let reverse = mapping.reverse(range);
        if (!reverse) {
          continue;
        }

        if (range.id === secondRange.id) {
          reverse = reverse.deltaStart(-rawRanges[0].length);
        }

        if (range.id === secondLastRange.id) {
          reverse = reverse.deltaEnd(rawRanges[length - 1].length);
        }

        if (range.turnDirection === EditorViewType.CURRENT) {
          if (!mergeRangeTurnLeft) {
            mergeRangeTurnLeft = reverse;
          } else {
            mergeRangeTurnLeft = mergeRangeTurnLeft.merge(reverse);
          }
        } else if (range.turnDirection === EditorViewType.INCOMING) {
          if (!mergeRangeTurnRight) {
            mergeRangeTurnRight = reverse;
          } else {
            mergeRangeTurnRight = mergeRangeTurnRight.merge(reverse);
          }
        }

        mapping.deleteRange(reverse);
      }

      if (mergeRangeTurnLeft) {
        const newLineRange = mergeRangeTurnLeft.born();
        this.documentMappingTurnLeft.addRange(newLineRange, mergeRange);
      }

      if (mergeRangeTurnRight) {
        const newLineRange = mergeRangeTurnRight.born();
        this.documentMappingTurnRight.addRange(newLineRange, mergeRange);
      }
    }
  }

  protected override prepareRenderDecorations(): [LineRange[], InnerRange[][]] {
    const diffRanges: LineRange[] = this.getAllDiffRanges().sort((a, b) => a.startLineNumber - b.startLineNumber);
    const innerChangesResult: InnerRange[][] = [];

    const maybeNeedMergeRanges = this.distillNeedMergeRanges(diffRanges);
    this.handleNeedMergeRanges(maybeNeedMergeRanges);

    /**
     * 如果 maybeNeedMergeRanges 大于 0，说明数据源 document mapping 的对应关系被改变
     * 则需要重新获取一次
     */
    const changesResult: LineRange[] = maybeNeedMergeRanges.length > 0 ? this.getAllDiffRanges() : diffRanges;
    return [changesResult, innerChangesResult];
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
    range: LineRange,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      linesDecorationsClassName: DECORATIONS_CLASSNAME.combine(
        preDecorations.className || '',
        DECORATIONS_CLASSNAME.stretch_right,
        range.turnDirection === EditorViewType.CURRENT ? DECORATIONS_CLASSNAME.stretch_left : '',
      ),
      className: DECORATIONS_CLASSNAME.combine(
        preDecorations.className || '',
        range.turnDirection === EditorViewType.CURRENT
          ? DECORATIONS_CLASSNAME.stretch_left
          : DECORATIONS_CLASSNAME.combine(DECORATIONS_CLASSNAME.stretch_left, DECORATIONS_CLASSNAME.stretch_right),
      ),
    };
  }

  public getEditorViewType(): EditorViewType {
    return EditorViewType.RESULT;
  }

  public override updateDecorations(): void {
    super.updateDecorations();
    // 每次 update decoration 时也需要更新 conflict actions 操作
    this.conflictActions.updateActions(this.provideActionsItems(this.getAllDiffRanges()));
  }

  public getContentInTimeMachineDocument(rangeId: string): ITimeMachineMetaData | undefined {
    return this.timeMachineDocument.getMetaData(rangeId);
  }

  public inputDiffComputingResult(changes: LineRangeMapping[], turnType: EDiffRangeTurn): void {
    if (turnType === EDiffRangeTurn.MODIFIED) {
      this.mappingManagerService.inputComputeResultRangeMappingTurnLeft(changes);
    } else if (turnType === EDiffRangeTurn.ORIGIN) {
      this.mappingManagerService.inputComputeResultRangeMappingTurnRight(changes);
    }

    if (turnType === EDiffRangeTurn.ORIGIN) {
      this.updateDecorations();
      const diffRanges = this.getAllDiffRanges();

      this.registerActionsProvider({
        provideActionsItems: () => this.provideActionsItems(diffRanges),
        onActionsClick: (range: LineRange, actionType: TActionsType) => {
          if (actionType === REVOKE_ACTIONS) {
            this._onDidConflictActions.fire({ range, withViewType: EditorViewType.RESULT, action: REVOKE_ACTIONS });
          }
        },
      });

      diffRanges.forEach((range) => {
        this.timeMachineDocument.record(range.id, {
          range,
          text: range.isEmpty ? null : this.editor.getModel()!.getValueInRange(range.toRange()),
        });
      });
    }
  }
}
