import type vscode from 'vscode';

import { EndOfLine, Position, Range, Selection } from '../../../../common/vscode/ext-types';

export interface ITextEditOperation {
  range: Range;
  text: string | null;
  forceMoveMarkers: boolean;
}

export interface IEditData {
  documentVersionId: number;
  edits: ITextEditOperation[];
  setEndOfLine: EndOfLine | undefined;
  undoStopBefore: boolean;
  undoStopAfter: boolean;
}

export class TextEditorEdit {
  private readonly _document: vscode.TextDocument;
  private readonly _documentVersionId: number;
  private _collectedEdits: ITextEditOperation[];
  private _setEndOfLine: EndOfLine | undefined;
  private readonly _undoStopBefore: boolean;
  private readonly _undoStopAfter: boolean;

  constructor(document: vscode.TextDocument, options: { undoStopBefore: boolean; undoStopAfter: boolean }) {
    this._document = document;
    this._documentVersionId = document.version;
    this._collectedEdits = [];
    this._setEndOfLine = undefined;
    this._undoStopBefore = options.undoStopBefore;
    this._undoStopAfter = options.undoStopAfter;
  }

  finalize(): IEditData {
    return {
      documentVersionId: this._documentVersionId,
      edits: this._collectedEdits,
      setEndOfLine: this._setEndOfLine,
      undoStopBefore: this._undoStopBefore,
      undoStopAfter: this._undoStopAfter,
    };
  }

  replace(location: Position | Range | Selection, value: string): void {
    let range: Range | null = null;

    if (location instanceof Position) {
      range = new Range(location, location);
    } else if (location instanceof Range) {
      range = location;
    } else {
      throw new Error('Unrecognized location');
    }

    this._pushEdit(range, value, false);
  }

  insert(location: Position, value: string): void {
    this._pushEdit(new Range(location, location), value, true);
  }

  delete(location: Range | Selection): void {
    let range: Range | null = null;

    if (location instanceof Range) {
      range = location;
    } else {
      throw new Error('Unrecognized location');
    }

    this._pushEdit(range, null, true);
  }

  private _pushEdit(range: Range, text: string | null, forceMoveMarkers: boolean): void {
    const validRange = this._document.validateRange(range);
    this._collectedEdits.push({
      range: validRange as Range,
      text,
      forceMoveMarkers,
    });
  }

  setEndOfLine(endOfLine: EndOfLine): void {
    if (endOfLine !== EndOfLine.LF && endOfLine !== EndOfLine.CRLF) {
      throw new Error('illegalArgument endOfLine');
    }
    this._setEndOfLine = endOfLine;
  }
}
