import { Injectable } from '@opensumi/di';
import { MergeConflictReportService } from '@opensumi/ide-core-browser/lib/ai-native/conflict-report.service';
import { CancelResponse, Disposable, ErrorResponse, Event, ReplyResponse } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';

import { MappingManagerService } from '../mapping-manager.service';
import { DocumentMapping } from '../model/document-mapping';
import { InnerRange } from '../model/inner-range';
import { LineRange } from '../model/line-range';
import {
  ACCEPT_COMBINATION_ACTIONS,
  ACCEPT_CURRENT_ACTIONS,
  ADDRESSING_TAG_CLASSNAME,
  AI_RESOLVE_ACTIONS,
  AI_RESOLVE_REGENERATE_ACTIONS,
  APPEND_ACTIONS,
  ECompleteReason,
  ETurnDirection,
  IActionsProvider,
  IConflictActionsEvent,
  IGNORE_ACTIONS,
  REVOKE_ACTIONS,
  TActionsType,
} from '../types';

import { BaseCodeEditor } from './editors/baseCodeEditor';
import { ResultCodeEditor } from './editors/resultCodeEditor';
import styles from './merge-editor.module.less';

type TLineRangeEdit = Array<{ range: LineRange; text: string | null }>;

@Injectable({ multiple: false })
export class ActionsManager extends Disposable {
  private currentView: BaseCodeEditor | undefined;
  private resultView: ResultCodeEditor | undefined;
  private incomingView: BaseCodeEditor | undefined;

  constructor(
    private readonly mappingManagerService: MappingManagerService,
    private readonly mergeConflictReportService: MergeConflictReportService,
  ) {
    super();
  }

  private applyLineRangeEdits(edits: TLineRangeEdit): void {
    if (!this.resultView) {
      return;
    }
    const model = this.resultView.getModel();
    const eol = model!.getEOL();

    if (!model) {
      return;
    }

    const modelLineCount = model.getLineCount();

    /**
     * 暂时先不处理 undo 和 redo 的情况
     * 可放在第二期来实现
     * 到时再采用 pushEditOperations 来处理
     */
    model.applyEdits(
      edits.map((edit) => {
        const { range, text } = edit;

        if (range.endLineNumberExclusive <= modelLineCount) {
          return {
            range: range.toRange(),
            text: text ? text + eol : null,
          };
        }

        if (range.startLineNumber === 1) {
          return {
            range: InnerRange.fromPositions(new Position(1, 1), new Position(modelLineCount, Number.MAX_SAFE_INTEGER)),
            text: text ? text + eol : null,
          };
        }

        return {
          range: InnerRange.fromPositions(
            new Position(range.startLineNumber - 1, Number.MAX_SAFE_INTEGER),
            new Position(modelLineCount, Number.MAX_SAFE_INTEGER),
          ),
          text: text ? eol + text : null,
        };
      }),
      false,
    );
  }

  private pickMapping(range: LineRange): DocumentMapping | undefined {
    switch (range.turnDirection) {
      case ETurnDirection.BOTH:
        return;
      case ETurnDirection.CURRENT:
        return this.mappingManagerService.documentMappingTurnLeft;
      case ETurnDirection.INCOMING:
        return this.mappingManagerService.documentMappingTurnRight;
    }
  }

  private pickViewEditor(range: LineRange): BaseCodeEditor {
    switch (range.turnDirection) {
      case ETurnDirection.INCOMING:
        return this.incomingView!;
      case ETurnDirection.CURRENT:
        return this.currentView!;
      default:
        return this.resultView!;
    }
  }

  /**
   * 接收 accept current 覆写或 accept append 追加文本内容
   */
  private handleAcceptChange(
    range: LineRange,
    acquireEdits: (
      range: LineRange,
      oppositeRange: LineRange,
      assistData: {
        applyText: string;
        eol: string;
      },
    ) => TLineRangeEdit,
    reason: ECompleteReason,
  ): void {
    const mapping = this.pickMapping(range);
    if (!mapping) {
      return;
    }

    const viewEditor = this.pickViewEditor(range);

    const model = viewEditor!.getModel()!;
    const eol = model.getEOL();

    const applyText = model.getValueInRange(range.toInclusiveRange());
    const oppositeRange = mapping.adjacentComputeRangeMap.get(range.id);

    if (!oppositeRange) {
      return;
    }

    this.applyLineRangeEdits(
      acquireEdits(range, oppositeRange, {
        applyText,
        eol,
      }),
    );

    this.markComplete(range, reason);

    /**
     * 如果 oppositeRange 是 merge range 合成的，则需要更新 current editor 和 incoming editor 的 actions
     */
    if (oppositeRange.isMerge) {
      this.currentView?.updateActions();
      this.incomingView?.updateActions();
    }

    /**
     * accept current 执行完之后都需要更新一遍 result 视图的 actions
     */
    this.resultView?.updateActions();
  }

  /**
   * 执行 revoke 时恢复文本内容
   */
  private handleAcceptRevoke(range: LineRange): void {
    const { turnDirection } = range;

    const viewEditor = this.pickViewEditor(range);
    const metaData = this.resultView!.getContentInTimeMachineDocument(range.id);
    if (!metaData) {
      return;
    }

    switch (turnDirection) {
      case ETurnDirection.CURRENT:
        this.mappingManagerService.revokeActionsTurnLeft(range);
        break;
      case ETurnDirection.INCOMING:
        this.mappingManagerService.revokeActionsTurnRight(range);
        break;
      case ETurnDirection.BOTH:
        this.mappingManagerService.revokeActionsTurnLeft(range);
        this.mappingManagerService.revokeActionsTurnRight(range);
        break;
    }

    const { text } = metaData;

    // 为 null 则说明是删除文本
    this.applyLineRangeEdits([{ range, text }]);

    this.resultView?.changeRangeIntelligentState(range, {}, true);
    this.resultView?.updateActions();

    if (turnDirection === ETurnDirection.BOTH) {
      this.incomingView?.updateDecorations().updateActions();
      this.currentView?.updateDecorations().updateActions();
    } else {
      viewEditor!.updateDecorations().updateActions();
    }
  }

  /**
   * 接受 accept combination 时将左右代码内容交替插入中间视图
   */
  private handleAcceptCombination(range: LineRange, reason: ECompleteReason): void {
    const reverseLeftRange = this.mappingManagerService.documentMappingTurnLeft.reverse(range);
    const reverseRightRange = this.mappingManagerService.documentMappingTurnRight.reverse(range);

    if (!reverseLeftRange || !reverseRightRange) {
      return;
    }

    const [metaTurnLeftMergeRanges, metaTurnRightMergeRanges] = [
      reverseLeftRange.metaMergeRanges,
      reverseRightRange.metaMergeRanges,
    ];

    const [iterableLeftRange, iterableRightRange] = [
      new Set(metaTurnLeftMergeRanges).values(),
      new Set(metaTurnRightMergeRanges).values(),
    ];

    /**
     * 0: left, 1: right
     * 由于 combination 的特性, metaMergeRanges 列表一定是左右交替的
     * 所以在这里需要判断出 metaMergeRanges 列表里第一个 range 的方向 turnDirection 是左还是右
     */
    let flagDirection = metaTurnLeftMergeRanges[0].startLineNumber === reverseLeftRange.startLineNumber ? 0 : 1;
    const concatLength = metaTurnLeftMergeRanges.length + metaTurnRightMergeRanges.length;

    let text = '';

    Array.from({ length: concatLength }).forEach((_, idx) => {
      const viewEditor = flagDirection === 0 ? this.currentView : this.incomingView;
      const model = viewEditor!.getModel()!;
      const eol = idx === concatLength - 1 ? '' : model.getEOL();

      const { value } = flagDirection === 0 ? iterableLeftRange.next() : iterableRightRange.next();

      text += model.getValueInRange(value!.toRange()) + eol;

      // 换方向
      flagDirection ^= 1;
    });

    this.applyLineRangeEdits([
      {
        text,
        range,
      },
    ]);

    this.markComplete(reverseLeftRange, reason);
    this.markComplete(reverseRightRange, reason);

    this.resultView?.updateActions();
  }

  /**
   * 处理 AI 智能解决冲突时的逻辑
   */
  public async handleAIConflictResolve(
    flushRange: LineRange,
    options: {
      isRegenerate: boolean;
    },
  ): Promise<{ isSuccess: boolean; isCancel: boolean; errorCode: number; errorMsg: string } | undefined> {
    if (!this.resultView) {
      return;
    }

    const model = this.resultView.getModel();

    if (!model) {
      return;
    }

    const reverseLeftRange = this.mappingManagerService.documentMappingTurnLeft.reverse(flushRange);
    const reverseRightRange = this.mappingManagerService.documentMappingTurnRight.reverse(flushRange);

    if (!reverseLeftRange || !reverseRightRange) {
      return;
    }

    this.resultView.changeRangeIntelligentState(flushRange, { isLoading: true }, false);
    this.resultView.updateDecorations().updateActions();

    const skeletonDecorationDispose = this.resultView.renderSkeletonDecoration(flushRange, [
      styles.skeleton_decoration,
      styles.skeleton_decoration_background,
    ]);

    const metaData = this.resultView!.getContentInTimeMachineDocument(flushRange.id);
    if (!metaData) {
      return;
    }

    const baseValue = metaData.text;
    const currentValue = this.currentView?.getModel()?.getValueInRange(reverseLeftRange.toInclusiveRange());
    const incomingValue = this.incomingView?.getModel()?.getValueInRange(reverseRightRange.toInclusiveRange());

    this.mergeConflictReportService.reportIncrementNum(this.resultView.getUri(), 'clickNum');

    const resolveConflictResult = await this.resultView.requestAIResolveConflict(
      { base: baseValue || '', current: currentValue || '', incoming: incomingValue || '' },
      flushRange,
      !!options?.isRegenerate,
    );

    this.resultView.changeRangeIntelligentState(flushRange, { isLoading: false }, false);
    skeletonDecorationDispose();

    if (ReplyResponse.is(resolveConflictResult)) {
      const answerCode = (resolveConflictResult as ReplyResponse).message;

      this.resultView.changeRangeIntelligentState(flushRange, { isComplete: true, answerCode }, true);
      this.applyLineRangeEdits([{ range: flushRange, text: answerCode }]);
      this.mergeConflictReportService.reportIncrementNum(this.resultView.getUri(), 'aiOutputNum');
      this.resultView!.updateDecorations().updateActions();
      return {
        isSuccess: true,
        isCancel: false,
        errorCode: 0,
        errorMsg: '',
      };
    }

    this.resultView!.updateDecorations().updateActions();

    if (CancelResponse.is(resolveConflictResult)) {
      this.mergeConflictReportService.reportIncrementNum(this.resultView.getUri(), 'cancelNum');
      return {
        isSuccess: false,
        isCancel: true,
        errorCode: 0,
        errorMsg: '',
      };
    }

    if (ErrorResponse.is(resolveConflictResult)) {
      return {
        isSuccess: false,
        isCancel: false,
        errorCode: (resolveConflictResult as ErrorResponse).error || 0,
        errorMsg: (resolveConflictResult as ErrorResponse).message || '',
      };
    }

    return {
      isSuccess: false,
      isCancel: false,
      errorCode: 0,
      errorMsg: '',
    };
  }

  private markComplete(range: LineRange, reason: ECompleteReason): void {
    const { turnDirection } = range;

    switch (turnDirection) {
      case ETurnDirection.CURRENT: {
        this.mappingManagerService.markCompleteTurnLeft(range, reason);
        this.currentView!.updateDecorations().updateActions();
        break;
      }
      case ETurnDirection.INCOMING: {
        this.mappingManagerService.markCompleteTurnRight(range, reason);
        this.incomingView!.updateDecorations().updateActions();
        break;
      }
    }
  }

  private initListenEvent(): void {
    if (!this.currentView || !this.resultView || !this.incomingView) {
      return;
    }

    this.addDispose(
      Event.any<{
        provider: IActionsProvider;
        editor: BaseCodeEditor;
      }>(
        this.currentView.onDidActionsProvider,
        this.resultView.onDidActionsProvider,
        this.incomingView.onDidActionsProvider,
      )(({ provider, editor }) => {
        const { provideActionsItems } = provider;
        editor.setConflictActions(provideActionsItems.call(editor));
      }),
    );

    this.addDispose(
      Event.any<IConflictActionsEvent>(
        this.currentView.onDidConflictActions,
        this.resultView.onDidConflictActions,
        this.incomingView.onDidConflictActions,
      )(async ({ range, action, reason }) => {
        switch (action) {
          case ACCEPT_CURRENT_ACTIONS:
            this.handleAcceptChange(
              range,
              (_range, oppositeRange, { applyText }) => [{ range: oppositeRange, text: applyText }],
              reason,
            );
            break;
          case IGNORE_ACTIONS:
            this.markComplete(range, reason);
            this.resultView?.updateActions();
            break;
          case REVOKE_ACTIONS:
            this.handleAcceptRevoke(range);
            break;
          case ACCEPT_COMBINATION_ACTIONS:
            this.handleAcceptCombination(range, reason);
            break;
          case APPEND_ACTIONS:
            /**
             * range 如果是 merge range 合成的，当 accept 某一视图的代码变更时，另一边的 accpet 就变成 append 追加内容，而不是覆盖内容
             */
            this.handleAcceptChange(
              range,
              (_, oppositeRange, { applyText, eol }) => [
                /**
                 * 在 diff 区域的最后一行追加代码内容
                 */
                {
                  range: LineRange.fromPositions(
                    oppositeRange.endLineNumberExclusive,
                    oppositeRange.endLineNumberExclusive,
                  ),
                  text: applyText,
                },
              ],
              reason,
            );
            break;
          /**
           * 处理 AI 智能解决冲突
           */
          case AI_RESOLVE_ACTIONS:
          case AI_RESOLVE_REGENERATE_ACTIONS:
            if (this.resultView) {
              const flushRange = this.resultView.getFlushRange(range) || range;
              await this.handleAIConflictResolve(flushRange, {
                isRegenerate: action === AI_RESOLVE_REGENERATE_ACTIONS,
              });
            }
            break;
        }
        if (this.resultView) {
          this.resultView.updateDecorations();
        }
        if (this.currentView) {
          this.currentView.launchChange();
        }
        if (this.incomingView) {
          this.incomingView.launchChange();
        }
      }),
    );
  }

  public mount(currentView: BaseCodeEditor, resultView: ResultCodeEditor, incomingView: BaseCodeEditor): void {
    this.currentView = currentView;
    this.resultView = resultView;
    this.incomingView = incomingView;

    const handleMouseDown = (e: IEditorMouseEvent, _this: BaseCodeEditor) => {
      const provider = _this.actionsProvider;
      if (!provider) {
        return;
      }

      let { mouseDownGuard } = provider;
      const { onActionsClick } = provider;

      if (typeof mouseDownGuard === 'undefined') {
        mouseDownGuard = (e: IEditorMouseEvent) => {
          if (e.event.rightButton) {
            return false;
          }

          if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
            return false;
          }

          const { element } = e.target;

          if (!element?.className.includes(ADDRESSING_TAG_CLASSNAME)) {
            return false;
          }

          return true;
        };
      }

      if (mouseDownGuard(e) && onActionsClick) {
        const element = e.target.element!;
        const { classList } = element;

        const find = Array.from(classList).find((c) => c.startsWith(ADDRESSING_TAG_CLASSNAME));

        if (find) {
          const rangeId = find.replace(ADDRESSING_TAG_CLASSNAME, '');
          const action = _this.conflictActions.getAction(rangeId);

          let type: TActionsType | undefined;

          const actions: TActionsType[] = [
            ACCEPT_CURRENT_ACTIONS,
            ACCEPT_COMBINATION_ACTIONS,
            IGNORE_ACTIONS,
            REVOKE_ACTIONS,
            APPEND_ACTIONS,
            AI_RESOLVE_ACTIONS,
          ];

          for (const action of actions) {
            if (classList.contains(action)) {
              type = action;
              break;
            }
          }

          if (type && action) {
            onActionsClick.call(_this, action.range, type);
          }
        }
      }
    };

    this.addDispose(currentView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, currentView)));
    this.addDispose(incomingView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, incomingView)));
    this.addDispose(resultView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, resultView)));
    this.initListenEvent();
  }
}
