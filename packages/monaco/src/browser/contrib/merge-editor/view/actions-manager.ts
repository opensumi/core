import { Disposable, Event } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ISingleEditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { MappingManagerService } from '../mapping-manager.service';
import { DocumentMapping } from '../model/document-mapping';
import { LineRange } from '../model/line-range';
import {
  IConflictActionsEvent,
  ACCEPT_CURRENT_ACTIONS,
  IGNORE_ACTIONS,
  ADDRESSING_TAG_CLASSNAME,
  TActionsType,
  ACCEPT_COMBINATION_ACTIONS,
  REVOKE_ACTIONS,
  IActionsProvider,
  ETurnDirection,
  APPEND_ACTIONS,
} from '../types';

import { BaseCodeEditor } from './editors/baseCodeEditor';
import { ResultCodeEditor } from './editors/resultCodeEditor';

// interface IEditsElement =

export class ActionsManager extends Disposable {
  private currentView: BaseCodeEditor | undefined;
  private resultView: ResultCodeEditor | undefined;
  private incomingView: BaseCodeEditor | undefined;

  constructor(private readonly mappingManagerService: MappingManagerService) {
    super();
  }

  private applyLineRangeEdits(edits: ISingleEditOperation[]): void {
    if (!this.resultView) {
      return;
    }
    const model = this.resultView.getModel();

    if (!model) {
      return;
    }

    /**
     * 暂时先不处理 undo 和 redo 的情况
     * 可放在第二期来实现
     * 到时再采用 pushEditOperations 来处理
     */
    model.applyEdits(
      edits.map((edit) => {
        const { range, text } = edit;

        return {
          range,
          isAutoWhitespaceEdit: false,
          text,
        };
      }),
      false,
    );
  }

  private pickMapping(range: LineRange): DocumentMapping | undefined {
    if (range.turnDirection === ETurnDirection.BOTH) {
      return;
    }

    return range.turnDirection === ETurnDirection.CURRENT
      ? this.mappingManagerService.documentMappingTurnLeft
      : this.mappingManagerService.documentMappingTurnRight;
  }

  private pickViewEditor(range: LineRange): BaseCodeEditor {
    const { turnDirection } = range;

    if (turnDirection === ETurnDirection.INCOMING) {
      return this.incomingView!;
    }

    if (turnDirection === ETurnDirection.CURRENT) {
      return this.currentView!;
    }

    return this.resultView!;
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
    ) => ISingleEditOperation[],
  ): void {
    const mapping = this.pickMapping(range);
    if (!mapping) {
      return;
    }

    const viewEditor = this.pickViewEditor(range);

    const model = viewEditor!.getModel()!;
    const eol = model.getEOL();

    const applyText = model.getValueInRange(range.toRange());
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

    this.markComplete(range);

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

    if (turnDirection === ETurnDirection.CURRENT) {
      this.mappingManagerService.revokeActionsTurnLeft(range);
    }

    if (turnDirection === ETurnDirection.INCOMING) {
      this.mappingManagerService.revokeActionsTurnRight(range);
    }

    if (turnDirection === ETurnDirection.BOTH) {
      this.mappingManagerService.revokeActionsTurnLeft(range);
      this.mappingManagerService.revokeActionsTurnRight(range);
    }

    const model = viewEditor.getModel()!;
    const eol = model.getEOL();
    const { text } = metaData;

    // 为 null 则说明是删除文本
    if (text) {
      this.applyLineRangeEdits([{ range: range.toRange(), text: text + (range.isEmpty ? eol : '') }]);
    } else {
      this.applyLineRangeEdits([{ range: range.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER), text: null }]);
    }

    this.resultView?.updateActions();

    if (turnDirection === ETurnDirection.BOTH) {
      this.incomingView?.updateDecorations().updateActions();
      this.currentView?.updateDecorations().updateActions();
    } else {
      viewEditor!.updateDecorations().updateActions();
    }
  }

  /**
   * 接受 accept combination 时讲左右文本内容分别写入中间视图
   * 但这里需要注意的是
   * 在执行 applyLineRangeEdits 时得用 metaMergeRanges 数组里的 range
   */
  private handleAcceptCombination(range: LineRange): void {
    const reverseLeftRange = this.mappingManagerService.documentMappingTurnLeft.reverse(range);
    const reverseRightRange = this.mappingManagerService.documentMappingTurnRight.reverse(range);

    if (!reverseLeftRange || !reverseRightRange) {
      return;
    }

    const { metaMergeRanges } = range;
    const editTexts: { text: string | undefined; range: IRange }[] = [];

    const pushEdits = (metaRange: LineRange, viewEditor: BaseCodeEditor, iterable: IterableIterator<LineRange>) => {
      const { value } = iterable.next();
      if (value) {
        const model = viewEditor.getModel()!;
        const eol = model.getEOL();
        const range = metaRange.isEmpty
          ? metaRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER)
          : metaRange.toRange();
        const text = (metaRange.isEmpty ? eol : '') + model.getValueInRange(value.toRange());

        editTexts.push({ range, text });
      }
    };

    const iterableLeftRange = new Set(reverseLeftRange.metaMergeRanges).values();
    const iterableRightRange = new Set(reverseRightRange.metaMergeRanges).values();

    for (const metaRange of metaMergeRanges) {
      if (metaRange.turnDirection === ETurnDirection.CURRENT) {
        pushEdits(metaRange, this.currentView!, iterableLeftRange);
      }
      if (metaRange.turnDirection === ETurnDirection.INCOMING) {
        pushEdits(metaRange, this.incomingView!, iterableRightRange);
      }
    }

    this.applyLineRangeEdits(editTexts.map(({ text, range }) => ({ range, text: text || null })));

    this.markComplete(reverseLeftRange);
    this.markComplete(reverseRightRange);

    this.resultView?.updateActions();
  }

  private markComplete(range: LineRange): void {
    const { turnDirection } = range;

    if (turnDirection === ETurnDirection.CURRENT) {
      this.mappingManagerService.markCompleteTurnLeft(range);
      this.currentView!.updateDecorations().updateActions();
    }

    if (turnDirection === ETurnDirection.INCOMING) {
      this.mappingManagerService.markCompleteTurnRight(range);
      this.incomingView!.updateDecorations().updateActions();
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
      )(({ range, action }) => {
        if (action === ACCEPT_CURRENT_ACTIONS) {
          this.handleAcceptChange(range, (range, oppositeRange, { applyText, eol }) => [
            {
              range: range.isEmpty
                ? oppositeRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER)
                : oppositeRange.toRange(),
              text: applyText + (oppositeRange.isEmpty ? eol : ''),
            },
          ]);
        }

        if (action === IGNORE_ACTIONS) {
          this.markComplete(range);
          this.resultView?.updateActions();
        }

        if (action === REVOKE_ACTIONS) {
          this.handleAcceptRevoke(range);
        }

        if (action === ACCEPT_COMBINATION_ACTIONS) {
          this.handleAcceptCombination(range);
        }

        /**
         * range 如果是 merge range 合成的，当 accept 某一视图的代码变更时，另一边的 accpet 就变成 append 追加内容，而不是覆盖内容
         */
        if (action === APPEND_ACTIONS) {
          this.handleAcceptChange(range, (_, oppositeRange, { applyText, eol }) => [
            /**
             * 在 diff 区域的最后一行追加代码内容
             */
            {
              range: LineRange.fromPositions(
                oppositeRange.endLineNumberExclusive,
                oppositeRange.endLineNumberExclusive,
              ).toRange(),
              text: applyText + eol,
            },
          ]);
        }

        this.resultView!.updateDecorations();
        this.currentView!.launchChange();
        this.incomingView!.launchChange();
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

          if (classList.contains(ACCEPT_CURRENT_ACTIONS)) {
            type = ACCEPT_CURRENT_ACTIONS;
          } else if (classList.contains(ACCEPT_COMBINATION_ACTIONS)) {
            type = ACCEPT_COMBINATION_ACTIONS;
          } else if (classList.contains(IGNORE_ACTIONS)) {
            type = IGNORE_ACTIONS;
          } else if (classList.contains(REVOKE_ACTIONS)) {
            type = REVOKE_ACTIONS;
          } else if (classList.contains(APPEND_ACTIONS)) {
            type = APPEND_ACTIONS;
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
