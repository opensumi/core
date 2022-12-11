import { Disposable, Event } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { MappingManagerService } from '../mapping-manager.service';
import { LineRange } from '../model/line-range';
import {
  EditorViewType,
  IConflictActionsEvent,
  ACCEPT_CURRENT_ACTIONS,
  IGNORE_ACTIONS,
  ADDRESSING_TAG_CLASSNAME,
  TActionsType,
  ACCEPT_COMBINATION_ACTIONS,
  REVOKE_ACTIONS,
  IActionsProvider,
  ETurnDirection,
} from '../types';

import { BaseCodeEditor } from './editors/baseCodeEditor';
import { ResultCodeEditor } from './editors/resultCodeEditor';

export class ActionsManager extends Disposable {
  private currentView: BaseCodeEditor | undefined;
  private resultView: ResultCodeEditor | undefined;
  private incomingView: BaseCodeEditor | undefined;

  constructor(private readonly mappingManagerService: MappingManagerService) {
    super();
  }

  private applyLineRangeEdits(edits: { range: IRange; text: string | null }[]): void {
    if (!this.resultView) {
      return;
    }
    const model = this.resultView.getModel();

    if (!model) {
      return;
    }

    model.pushStackElement();
    model.pushEditOperations(
      null,
      edits.map((edit) => {
        const { range, text } = edit;

        return {
          range,
          isAutoWhitespaceEdit: false,
          text,
        };
      }),
      () => null,
    );
    model.pushStackElement();
  }

  private markComplete(range: LineRange): void {
    const { turnDirection } = range;

    if (turnDirection === ETurnDirection.CURRENT) {
      this.mappingManagerService.markCompleteTurnLeft(range);
      this.currentView?.updateDecorations();
    }

    if (turnDirection === ETurnDirection.INCOMING) {
      this.mappingManagerService.markCompleteTurnRight(range);
      this.incomingView?.updateDecorations();
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
      )(({ range, withViewType, action }) => {
        const { turnDirection } = range;

        const viewEditor = turnDirection === ETurnDirection.CURRENT ? this.currentView : this.incomingView;

        /**
         * accept current 或 ignore
         */
        if (withViewType !== EditorViewType.RESULT) {
          if (action === ACCEPT_CURRENT_ACTIONS) {
            const documentMapping =
              turnDirection === ETurnDirection.CURRENT
                ? this.mappingManagerService.documentMappingTurnLeft
                : this.mappingManagerService.documentMappingTurnRight;
            const model = viewEditor!.getModel()!;
            const eol = model.getEOL();

            const applyText = model.getValueInRange(range.toRange());
            const sameRange = documentMapping.adjacentComputeRangeMap.get(range.id);

            if (!sameRange) {
              return;
            }

            this.applyLineRangeEdits([
              {
                range: range.isEmpty ? sameRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER) : sameRange.toRange(),
                text: applyText + (sameRange.isEmpty ? eol : ''),
              },
            ]);
          }

          this.markComplete(range);
        } else {
          if (action === REVOKE_ACTIONS) {
            if (turnDirection === ETurnDirection.CURRENT) {
              this.mappingManagerService.revokeActionsTurnLeft(range);
            } else if (turnDirection === ETurnDirection.INCOMING) {
              this.mappingManagerService.revokeActionsTurnRight(range);
            }

            const metaData = this.resultView!.getContentInTimeMachineDocument(range.id);
            if (!metaData) {
              return;
            }

            const { text } = metaData;

            if (text) {
              this.applyLineRangeEdits([
                {
                  range: range.toRange(),
                  text,
                },
              ]);
            } else {
              this.applyLineRangeEdits([
                {
                  range: range.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER),
                  text: null,
                },
              ]);
            }

            viewEditor!.updateDecorations();
          } else if (action === ACCEPT_COMBINATION_ACTIONS) {
            const turnLeftReverseRange = this.mappingManagerService.documentMappingTurnLeft.reverse(range);
            const turnRightReverseRange = this.mappingManagerService.documentMappingTurnRight.reverse(range);

            if (!turnLeftReverseRange || !turnRightReverseRange) {
              return;
            }

            const iterableLeftRange = new Set(turnLeftReverseRange.metaMergeRanges).values();
            const iterableRightRange = new Set(turnRightReverseRange.metaMergeRanges).values();

            const { metaMergeRanges } = range;
            const editTexts: { text: string | undefined; range: IRange }[] = [];

            for (const metaRange of metaMergeRanges) {
              if (metaRange.turnDirection === ETurnDirection.CURRENT) {
                const { value } = iterableLeftRange.next();
                if (value) {
                  editTexts.push({
                    text: this.currentView?.getModel()!.getValueInRange(value.toRange()),
                    range: metaRange.toRange(),
                  });
                }
              } else if (metaRange.turnDirection === ETurnDirection.INCOMING) {
                const { value } = iterableRightRange.next();
                if (value) {
                  editTexts.push({
                    text: this.incomingView?.getModel()!.getValueInRange(value.toRange()),
                    range: metaRange.toRange(),
                  });
                }
              }
            }

            this.applyLineRangeEdits(
              editTexts.map(({ text, range }) => ({
                range,
                text: text || null,
              })),
            );

            this.markComplete(turnLeftReverseRange);
            this.markComplete(turnRightReverseRange);
          }
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
