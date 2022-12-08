import { Injectable, Injector } from '@opensumi/di';
import { Emitter, Event, MonacoService } from '@opensumi/ide-core-browser';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { TimeMachineDocument } from '../../model/time-machine';
import {
  EditorViewType,
  LineRangeType,
  DECORATIONS_CLASSNAME,
  TActionsType,
  ADDRESSING_TAG_CLASSNAME,
  CONFLICT_ACTIONS_ICON,
  EDiffRangeTurn,
  IActionsDescription,
  REVOKE_ACTIONS,
  ITimeMachineMetaData,
} from '../../types';
import { flatInnerModified, flatModified, flatOriginal, flatInnerOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  private readonly _onDidChangeContent = new Emitter<void>();
  public readonly onDidChangeContent: Event<void> = this._onDidChangeContent.event;

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { lineNumbersMinChars: 2, lineDecorationsWidth: 24 };
  }

  private timeMachineDocument: TimeMachineDocument;
  private currentTurnType: EDiffRangeTurn;

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

  protected override prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: InnerRange[][],
  ): [LineRange[], InnerRange[][]] {
    const toBeRanges: LineRange[] =
      this.currentTurnType === EDiffRangeTurn.MODIFIED
        ? this.documentMappingTurnLeft.getOriginalRange()
        : this.documentMappingTurnRight.getModifiedRange();

    const changesResult: LineRange[] = [];
    const innerChangesResult: InnerRange[][] = [];

    ranges.forEach((range, idx) => {
      const sameInner = innerChanges[idx];
      const sameRange = toBeRanges[idx];
      const _exec = (type: LineRangeType) => {
        const direction =
          this.currentTurnType === EDiffRangeTurn.ORIGIN ? EditorViewType.INCOMING : EditorViewType.CURRENT;
        changesResult.push(range.setType(type).setTurnDirection(direction));
        innerChangesResult.push(sameInner.map((i) => i.setType(type).setTurnDirection(direction)));
        const entries = this.documentMappingTurnLeft.adjacentComputeRangeMap.entries();
        for (const [key, value] of entries) {
          if (sameRange.id === key) {
            this.documentMappingTurnLeft.adjacentComputeRangeMap.set(
              key,
              value.setType(type).setTurnDirection(direction),
            );
          }
        }
      };

      _exec(range.isTendencyLeft(sameRange) ? 'remove' : range.isTendencyRight(sameRange) ? 'insert' : 'modify');
    });
    return [changesResult, innerChangesResult];
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    if (this.currentTurnType === EDiffRangeTurn.MODIFIED) {
      return [];
    }

    const values = this.documentMappingTurnLeft.getModifiedRange();
    const retain: IDiffDecoration[] = [];
    for (const range of values) {
      if (!range.isEmpty) {
        retain.push(...this.decorations.createLineDecoration(range));
      }
    }
    return retain;
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    if (this.currentTurnType === EDiffRangeTurn.MODIFIED) {
      return [];
    }

    const values = this.documentMappingTurnLeft.getModifiedRange();
    const retain: GuidelineWidget[] = [];
    for (const range of values) {
      if (range.isEmpty) {
        retain.push(this.decorations.createGuideLineWidget(range));
      }
    }
    return retain;
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

  public updateDecorations(): void {
    const toBeRanges: LineRange[] =
      this.currentTurnType === EDiffRangeTurn.MODIFIED
        ? this.documentMappingTurnLeft.getModifiedRange()
        : this.documentMappingTurnRight.getOriginalRange();
    this.decorations
      .setRetainDecoration(this.getRetainDecoration())
      .setRetainLineWidget(this.getRetainLineWidget())
      .updateDecorations(toBeRanges, []);

    // 每次 update decoration 时也需要更新 conflict actions 操作
    this.conflictActions.updateActions(this.provideActionsItems(this.getAllDiffRanges()));
  }

  public getContentInTimeMachineDocument(rangeId: string): ITimeMachineMetaData | undefined {
    return this.timeMachineDocument.getMetaData(rangeId);
  }

  public inputDiffComputingResult(changes: LineRangeMapping[], turnType: EDiffRangeTurn): void {
    this.currentTurnType = turnType;

    if (turnType === EDiffRangeTurn.MODIFIED) {
      this.mappingManagerService.inputComputeResultRangeMappingTurnLeft(changes);
      this.renderDecorations(flatModified(changes), flatInnerModified(changes));
    } else if (turnType === EDiffRangeTurn.ORIGIN) {
      this.mappingManagerService.inputComputeResultRangeMappingTurnRight(changes);
      this.renderDecorations(flatOriginal(changes), flatInnerOriginal(changes));
    }

    if (turnType === EDiffRangeTurn.ORIGIN) {
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
