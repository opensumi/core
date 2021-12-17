/**
 * 用于实现效率更高的编辑操作
 */

import { IRange, IPosition, IEditOperation } from './types/editor';

export class BasicTextLines {
  constructor(protected readonly _lines: string[], protected _eol: '\n' | '\r\n') {}

  getContent() {
    return this._lines.join(this._eol);
  }

  private _setLineText(lineIndex: number, newValue: string): void {
    this._lines[lineIndex] = newValue;
  }

  public acceptEol(eol: '\n' | '\r\n') {
    this._eol = eol;
  }

  public acceptChange(change: IEditOperation) {
    this._acceptDeleteRange(change.range);
    this._acceptInsertText(
      { lineNumber: change.range.startLineNumber, column: change.range.startColumn },
      change.text || '',
    );
  }

  private _getLineContent(index: number): string {
    return this._lines[index] || '';
  }

  private _acceptDeleteRange(range: IRange): void {
    if (range.startLineNumber === range.endLineNumber) {
      if (range.startColumn === range.endColumn) {
        // Nothing to delete
        return;
      }
      // Delete text on the affected line
      this._setLineText(
        range.startLineNumber - 1,
        this._getLineContent(range.startLineNumber - 1).substring(0, range.startColumn - 1) +
          this._getLineContent(range.startLineNumber - 1).substring(range.endColumn - 1),
      );
      return;
    }

    // Take remaining text on last line and append it to remaining text on first line
    this._setLineText(
      range.startLineNumber - 1,
      this._getLineContent(range.startLineNumber - 1).substring(0, range.startColumn - 1) +
        this._getLineContent(range.endLineNumber - 1).substring(range.endColumn - 1),
    );

    // Delete middle lines
    this._lines.splice(range.startLineNumber, range.endLineNumber - range.startLineNumber);
  }

  private _acceptInsertText(position: IPosition, insertText: string): void {
    if (insertText.length === 0) {
      // Nothing to insert
      return;
    }
    const insertLines = insertText.split(/\r\n|\r|\n/);
    if (insertLines.length === 1) {
      // Inserting text on one line
      this._setLineText(
        position.lineNumber - 1,
        this._getLineContent(position.lineNumber - 1).substring(0, position.column - 1) +
          insertLines[0] +
          this._getLineContent(position.lineNumber - 1).substring(position.column - 1),
      );
      return;
    }

    // Append overflowing text from first line to the end of text to insert
    insertLines[insertLines.length - 1] += this._getLineContent(position.lineNumber - 1).substring(position.column - 1);

    // Delete overflowing text from first line and insert text on first line
    this._setLineText(
      position.lineNumber - 1,
      this._getLineContent(position.lineNumber - 1).substring(0, position.column - 1) + insertLines[0],
    );

    // Insert new lines & store lengths
    const newLengths = new Uint32Array(insertLines.length - 1);
    for (let i = 1; i < insertLines.length; i++) {
      this._lines.splice(position.lineNumber + i - 1, 0, insertLines[i]);
      newLengths[i - 1] = insertLines[i].length + this._eol.length;
    }
  }
}
