import { Disposable, Event } from '@opensumi/ide-core-common';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { MappingManagerService } from '../service/mapping-manager.service';
import { EditorViewType, IActionsDescription, IConflictActionsEvent } from '../types';

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
      )(({ range, withViewType }) => {
        if (withViewType === EditorViewType.CURRENT) {
          const sameRange = this.mappingManagerService.documentMappingTurnLeft.adjacentComputeRangeMap.get(range.id);

          const applyText = this.currentView!.getModel()!.getValueInRange(range.toRange());

          if (sameRange) {
            this.applyLineRangeEdits([
              {
                range: range.isEmpty ? sameRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER) : sameRange.toRange(),
                text: applyText + (sameRange.isEmpty ? '\n' : ''),
              },
            ]);

            this.mappingManagerService.markCompleteTurnLeft(range);

            this.currentView!.updateDecorations();
            this.currentView!.clearActions(range);

            this.resultView!.updateDecorations();

            this.currentView!.launchChange();
            this.incomingView!.launchChange();
          }
        }

        if (withViewType === EditorViewType.INCOMING) {
          const sameRange = this.mappingManagerService.documentMappingTurnRight.adjacentComputeRangeMap.get(range.id);

          const applyText = this.incomingView!.getModel()!.getValueInRange(range.toRange());

          if (sameRange) {
            this.applyLineRangeEdits([
              {
                range: range.isEmpty ? sameRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER) : sameRange.toRange(),
                text: applyText + (sameRange.isEmpty ? '\n' : ''),
              },
            ]);

            this.mappingManagerService.markCompleteTurnRight(range);

            this.incomingView!.updateDecorations();
            this.incomingView!.clearActions(range);

            this.resultView!.updateDecorations();

            this.currentView!.launchChange();
            this.incomingView!.launchChange();
          }
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
        onActionsClick.call(_this, e, currentView, resultView, incomingView);
      }
    };

    this.addDispose(currentView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, currentView)));
    this.addDispose(incomingView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, incomingView)));
    this.addDispose(resultView.getEditor().onMouseDown((e: IEditorMouseEvent) => handleMouseDown(e, resultView)));
    this.initListenEvent();
  }
}
