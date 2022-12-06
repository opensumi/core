import { Disposable, Event } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { MappingManagerService } from '../mapping-manager.service';
import { LineRange } from '../model/line-range';
import {
  EditorViewType,
  IActionsDescription,
  IConflictActionsEvent,
  ACCEPT_CURRENT_ACTIONS,
  IGNORE_ACTIONS,
  ADDRESSING_TAG_CLASSNAME,
  TActionsType,
  ACCEPT_COMBINATION_ACTIONS,
  REVOKE_ACTIONS,
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

  private applyLineRangeEdits(edits: { range: IRange; text: string }[]): void {
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

  private initListenEvent(): void {
    if (!this.currentView || !this.resultView || !this.incomingView) {
      return;
    }

    this.addDispose(
      Event.any<IConflictActionsEvent>(
        this.currentView.onDidConflictActions,
        this.resultView.onDidConflictActions,
        this.incomingView.onDidConflictActions,
      )(({ range, withViewType, action }) => {
        const markComplete = (range: LineRange) => {
          if (withViewType === EditorViewType.CURRENT) {
            this.mappingManagerService.markCompleteTurnLeft(range);
          } else if (withViewType === EditorViewType.INCOMING) {
            this.mappingManagerService.markCompleteTurnRight(range);
          }
        };

        if (withViewType !== EditorViewType.RESULT) {
          const documentMapping =
            withViewType === EditorViewType.CURRENT
              ? this.mappingManagerService.documentMappingTurnLeft
              : this.mappingManagerService.documentMappingTurnRight;
          const viewEditor = withViewType === EditorViewType.CURRENT ? this.currentView : this.incomingView;

          if (action === ACCEPT_CURRENT_ACTIONS) {
            const applyText = viewEditor!.getModel()!.getValueInRange(range.toRange());
            const sameRange = documentMapping.adjacentComputeRangeMap.get(range.id);

            if (!sameRange) {
              return;
            }

            this.applyLineRangeEdits([
              {
                range: range.isEmpty ? sameRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER) : sameRange.toRange(),
                text: applyText + (sameRange.isEmpty ? '\n' : ''),
              },
            ]);
          }

          markComplete(range);

          viewEditor!.updateDecorations();
          viewEditor!.clearActions(range);

          this.resultView!.updateDecorations();
          this.currentView!.launchChange();
          this.incomingView!.launchChange();
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
      const { onActionsClick, provideActionsItems } = provider;

      if (typeof mouseDownGuard === 'undefined') {
        const items = provideActionsItems();
        mouseDownGuard = (e: IEditorMouseEvent) => {
          if (e.event.rightButton) {
            return false;
          }

          if (e.target.type !== MouseTargetType.GUTTER_LINE_DECORATIONS) {
            return false;
          }

          const { position } = e.target;

          if (!items.some((item: IActionsDescription) => item.range.startLineNumber === position.lineNumber)) {
            return false;
          }

          return true;
        };
      }

      if (mouseDownGuard(e) === true && onActionsClick) {
        const element = e.target.element!;
        const { classList } = element;

        const find = Array.from(classList).find((c) => c.startsWith(ADDRESSING_TAG_CLASSNAME));

        if (find) {
          const rangeId = find.replace(ADDRESSING_TAG_CLASSNAME, '');

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

          if (type) {
            onActionsClick.call(_this, rangeId, type);
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
