import { createMutex } from 'lib0/mutex';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { ITextModel, ICodeEditor, Position } from '@opensumi/ide-monaco';
import {
  SelectionDirection,
  Selection,
  Range,
  IDisposable,
} from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export class TextModelBinding {
  savedSelections: RelativeSelection | undefined;

  mutex = createMutex();

  doc: Y.Doc;

  monacoChangeHandler: IDisposable;

  decorations: string[] = [];

  /**
   * Render decorations
   */
  renderDecorations = () => {
    if (this.editor.getModel() === this.textModel) {
      const currentDecorations = this.decorations;
      const newDecorations: any[] = []; // fixme
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
          if (anchorAbs !== null && headAbs !== null && anchorAbs.type === this.yText && headAbs.type === this.yText) {
            let start: Position;
            let end: Position;
            let afterContentClassName: string | null;
            let beforeContentClassName: string | null;

            // check if LTR or RTL
            if (anchorAbs.index < headAbs.index) {
              start = this.textModel.getPositionAt(anchorAbs.index);
              end = this.textModel.getPositionAt(headAbs.index);
              afterContentClassName = 'yRemoteSelectionHead yRemoteSelectionHead-' + clientID;
              beforeContentClassName = null;
            } else {
              start = this.textModel.getPositionAt(headAbs.index);
              end = this.textModel.getPositionAt(anchorAbs.index);
              afterContentClassName = null;
              beforeContentClassName = 'yRemoteSelectionHead yRemoteSelectionHead-' + clientID;
            }

            newDecorations.push({
              range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
              options: {
                className: 'yRemoteSelection yRemoteSelection-' + clientID,
                afterContentClassName,
                beforeContentClassName,
              },
            });
          }
        }
      });

      this.decorations = this.editor.deltaDecorations(currentDecorations, newDecorations);
    } else {
      // ignore decoration
      this.decorations = [];
    }
  };

  yTextObserver = (event: Y.YTextEvent) => {
    this.mutex(() => {
      // fixme line seq issue
      let index = 0;
      event.delta.forEach((op) => {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const pos = this.textModel.getPositionAt(index);
          const range = new Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
          this.textModel.applyEdits([{ range, text: op.insert }] as any);
          index += op.insert.length;
        } else if (op.delete !== undefined) {
          const pos = this.textModel.getPositionAt(index);
          const endPos = this.textModel.getPositionAt(index + op.delete);
          const range = new Selection(pos.lineNumber, pos.column, endPos.lineNumber, endPos.column);
          this.textModel.applyEdits([{ range, text: '' }]);
        } else {
          throw new Error('Unexpected');
        }
      });
      // restore self-saved selection
      if (this.savedSelections) {
        const sel = createMonacoSelectionFromRelativeSelection(
          this.textModel,
          this.yText,
          this.savedSelections,
          this.doc,
        );
        if (sel !== null) {
          this.editor.setSelection(sel);
        }
      }
    });
    this.renderDecorations();
  };

  beforeAllTransactions = () => {
    this.mutex(() => {
      this.savedSelections = undefined;
      if (this.editor.getModel() === this.textModel) {
        // const relSelection = createRelativeSelection(this.editor, this.textModel, this.yText);
        const relSelection = this.createRelativeSelection();
        if (relSelection !== null) {
          this.savedSelections = relSelection;
        }
      }
    });
  };

  createRelativeSelection() {
    const sel = this.editor.getSelection();
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

  constructor(
    private yText: Y.Text,
    private textModel: ITextModel,
    private editor: ICodeEditor,
    private awareness: Awareness,
  ) {
    this.doc = yText.doc!;
    this.initialize();
  }

  initialize() {
    this.yText.doc?.on('beforeAllTransactions', this.beforeAllTransactions);

    // yText observer
    this.yText.observe(this.yTextObserver);

    // set value
    const yTextValue = this.yText.toString();
    if (this.textModel.getValue() !== yTextValue) {
      this.textModel.setValue(yTextValue);
    }

    this.monacoChangeHandler = this.textModel.onDidChangeContent((event) => {
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
    });

    // register awareness
    this.editor.onDidChangeCursorSelection(() => {
      if (this.editor.getModel() === this.textModel) {
        const sel = this.editor.getSelection();
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
    });
    // when awareness changed, render decorations again
    this.awareness.on('change', this.renderDecorations);
  }

  dispose() {
    this.monacoChangeHandler.dispose();
    this.doc.off('beforeAllTransactions', this.beforeAllTransactions);
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

const createMonacoSelectionFromRelativeSelection = (
  model: ITextModel,
  type: Y.Text,
  relSel: RelativeSelection,
  doc: Y.Doc,
) => {
  const start = Y.createAbsolutePositionFromRelativePosition(relSel.start, doc);
  const end = Y.createAbsolutePositionFromRelativePosition(relSel.end, doc);
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
};
