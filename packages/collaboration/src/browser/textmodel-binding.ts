import { createMutex } from 'lib0/mutex';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { ITextModel, ICodeEditor, Position } from '@opensumi/ide-monaco';
import { IModelDeltaDecoration } from '@opensumi/ide-monaco/lib/browser/monaco-api/editor';
import {
  editor,
  SelectionDirection,
  Selection,
  Range,
  IDisposable,
} from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { ICollaborationService, ITextModelBinding, Y_REMOTE_SELECTION, Y_REMOTE_SELECTION_HEAD } from '../common';

import { CollaborationService } from './collaboration.service';

@Injectable({ multiple: true })
export class TextModelBinding implements ITextModelBinding {
  @Autowired(ICollaborationService)
  private collaborationService: CollaborationService;

  private savedSelections: Map<ICodeEditor, RelativeSelection> = new Map();

  private mutex = createMutex();

  private doc: Y.Doc;

  private disposableContentChangeHandler: IDisposable;

  private decorations: Map<ICodeEditor, string[]> = new Map();

  private editors: Set<ICodeEditor>;

  private disposables: Map<ICodeEditor, IDisposable> = new Map();

  private undoManger: Y.UndoManager;

  constructor(
    private yText: Y.Text,
    private textModel: ITextModel,
    private awareness: Awareness,
    editor?: ICodeEditor,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.doc = yText.doc!;
    this.editors = new Set();
    if (editor) {
      this.editors.add(editor);
    }
    this.initialize();
  }

  /**
   * Render decorations
   */
  private renderDecorations = () => {
    this.editors.forEach((editor) => {
      if (editor.getModel() === this.textModel) {
        const currentDecorations = this.decorations.get(editor) ?? [];
        const newDecorations: IModelDeltaDecoration[] = []; // re-populate decorations

        const cursorWidgetRegistry = this.collaborationService.getCursorWidgetRegistry(editor);

        // set position of CursorWidget to null
        cursorWidgetRegistry?.removeAllPositions();

        this.awareness.getStates().forEach((state, clientID) => {
          // if clientID is not mine, and selection from this client is not empty
          if (
            clientID !== this.doc.clientID &&
            state.selection != null &&
            state.selection.anchor != null &&
            state.selection.head != null
          ) {
            const anchorAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, this.doc);
            const headAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.head, this.doc);

            if (
              anchorAbs !== null &&
              headAbs !== null &&
              // ensure that the client is in the same Y.Text with mine
              anchorAbs.type === this.yText &&
              headAbs.type === this.yText
            ) {
              let start: Position;
              let end: Position;
              let afterContentClassName: string | null;
              let beforeContentClassName: string | null;

              // check if LTR or RTL
              if (anchorAbs.index < headAbs.index) {
                start = this.textModel.getPositionAt(anchorAbs.index);
                end = this.textModel.getPositionAt(headAbs.index);
                afterContentClassName = `${Y_REMOTE_SELECTION} ${Y_REMOTE_SELECTION_HEAD}-${clientID}`;
                beforeContentClassName = null;
              } else {
                start = this.textModel.getPositionAt(headAbs.index);
                end = this.textModel.getPositionAt(anchorAbs.index);
                afterContentClassName = null;
                beforeContentClassName = `${Y_REMOTE_SELECTION_HEAD} ${Y_REMOTE_SELECTION_HEAD}-${clientID}`;
              }

              newDecorations.push({
                range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
                options: {
                  description: 'yjs decoration ' + clientID,
                  className: `${Y_REMOTE_SELECTION} ${Y_REMOTE_SELECTION}-${clientID}`,
                  afterContentClassName,
                  beforeContentClassName,
                },
              });

              // update position
              cursorWidgetRegistry?.updatePositionOf(clientID, end.lineNumber, end.column);
            }
          }
        });

        // invoke layoutWidget method to update update all cursor widgets
        cursorWidgetRegistry?.layoutAllWidgets();

        // delta update decorations
        this.decorations.set(editor, editor.deltaDecorations(currentDecorations, newDecorations));
      } else {
        // remove all decoration, when current active TextModel of this editor is not this.textModel
        this.decorations.delete(editor);
      }
    });
  };

  private yTextObserver = (event: Y.YTextEvent) => {
    this.mutex(() => {
      // fixme line seq issue
      let index = 0;
      event.delta.forEach((op) => {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const pos = this.textModel.getPositionAt(index);
          const range = new Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
          this.textModel.applyEdits([{ range, text: op.insert as string }]);
          index += (op.insert as string).length;
        } else if (op.delete !== undefined) {
          const pos = this.textModel.getPositionAt(index);
          const endPos = this.textModel.getPositionAt(index + op.delete);
          const range = new Selection(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
          this.textModel.applyEdits([{ range, text: '' }]);
        } else {
          throw new Error('Unexpected error');
        }
      });
      this.savedSelections.forEach((relSelection, editor) => {
        // restore self-saved selection
        const sel = this.createMonacoSelectionFromRelativeSelection(relSelection);
        if (sel !== null) {
          editor.setSelection(sel);
        }
      });
    });
    this.renderDecorations();
  };

  private beforeAllTransactionsHandler = () => {
    this.mutex(() => {
      this.savedSelections = new Map();
      this.editors.forEach((editor) => {
        if (editor.getModel() === this.textModel) {
          const relSelection = this.createRelativeSelection(editor);
          if (relSelection !== null) {
            this.savedSelections.set(editor, relSelection);
          }
        }
      });
    });
  };

  private createRelativeSelection(editor: ICodeEditor) {
    const sel = editor.getSelection();
    const monacoModel = this.textModel;
    const type = this.yText;
    if (sel !== null) {
      const startPos = sel.getStartPosition();
      const endPos = sel.getEndPosition();
      const start = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(startPos));
      const end = Y.createRelativePositionFromTypeIndex(type, monacoModel.getOffsetAt(endPos));
      return new RelativeSelection(start, end, sel.getDirection());
    }
    return null;
  }

  private createMonacoSelectionFromRelativeSelection(relSel: RelativeSelection) {
    const doc = this.doc;
    const start = Y.createAbsolutePositionFromRelativePosition(relSel.start, doc);
    const end = Y.createAbsolutePositionFromRelativePosition(relSel.end, doc);
    const type = this.yText;
    const model = this.textModel;
    if (start !== null && end !== null && start.type === type && end.type === type) {
      const startPos = model.getPositionAt(start.index);
      const endPos = model.getPositionAt(end.index);
      return Selection.createWithDirection(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column,
        relSel.direction,
      );
    }
    return null;
  }

  private textModelOnDidChangeContentHandler = (event: editor.IModelContentChangedEvent) => {
    // apply changes from right to left
    this.mutex(() => {
      this.doc.transact(() => {
        event.changes
          .sort((change1, change2) => change2.rangeOffset - change1.rangeOffset)
          .forEach((change) => {
            // it will trigger y.text event
            this.yText.delete(change.rangeOffset, change.rangeLength);
            this.yText.insert(change.rangeOffset, change.text);
          });
      }, this);
    });
  };

  private onDidChangeCursorSelectionHandler = (editor: ICodeEditor) => () => {
    if (editor.getModel() === this.textModel) {
      const sel = editor.getSelection();
      if (sel === null) {
        return;
      }
      let anchor = this.textModel.getOffsetAt(sel.getStartPosition());
      let head = this.textModel.getOffsetAt(sel.getEndPosition());
      if (sel.getDirection() === SelectionDirection.RTL) {
        const tmp = anchor;
        anchor = head;
        head = tmp;
      }
      this.awareness.setLocalStateField('selection', {
        anchor: Y.createRelativePositionFromTypeIndex(this.yText, anchor),
        head: Y.createRelativePositionFromTypeIndex(this.yText, head),
      });
    }
  };

  private setModelContent() {
    const yTextValue = this.yText.toString();
    if (this.textModel.getValue() !== yTextValue) {
      this.textModel.setValue(yTextValue);
    }
  }

  initialize() {
    this.undoManger = new Y.UndoManager(this.yText, {
      trackedOrigins: new Set([this]),
    });

    this.setModelContent();

    // save current selections
    this.yText.doc?.on('beforeAllTransactions', this.beforeAllTransactionsHandler);

    // yText observer
    this.yText.observe(this.yTextObserver);

    this.disposableContentChangeHandler = this.textModel.onDidChangeContent(this.textModelOnDidChangeContentHandler);

    // register awareness
    this.editors.forEach((editor) => {
      this.disposables.set(editor, editor.onDidChangeCursorSelection(this.onDidChangeCursorSelectionHandler(editor)));
    });

    // when awareness changed, render decorations again
    this.awareness.on('change', this.renderDecorations);
  }

  changeYText(newText: Y.Text) {
    this.destroy();
    this.yText = newText;
    this.initialize();
  }

  undo() {
    this.undoManger.undo();
  }

  redo() {
    this.undoManger.redo();
  }

  addEditor(editor: ICodeEditor) {
    if (!this.editors.has(editor)) {
      this.disposables.set(editor, editor.onDidChangeCursorSelection(this.onDidChangeCursorSelectionHandler(editor)));
      this.editors.add(editor);
    }
    this.renderDecorations();
  }

  removeEditor(editor: ICodeEditor) {
    if (this.editors.has(editor)) {
      this.disposables.get(editor)?.dispose();
      this.disposables.delete(editor);
      this.editors.delete(editor);
    }
    this.renderDecorations();
  }

  /**
   * Stop listening to all events
   */
  destroy() {
    this.undoManger.destroy();
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposableContentChangeHandler.dispose();
    this.doc.off('beforeAllTransactions', this.beforeAllTransactionsHandler);
    this.yText.unobserve(this.yTextObserver);
    this.awareness.off('change', this.renderDecorations);
  }
}

class RelativeSelection {
  public start: Y.RelativePosition;
  public end: Y.RelativePosition;
  public direction: SelectionDirection;

  constructor(start: Y.RelativePosition, end: Y.RelativePosition, direction: SelectionDirection) {
    this.start = start;
    this.end = end;
    this.direction = direction;
  }
}
