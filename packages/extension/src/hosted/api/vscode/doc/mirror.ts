import { IRange, Position } from '@opensumi/ide-core-common';

import { IModelChangedEvent } from '../../../../common/vscode';
import { Uri } from '../../../../common/vscode/ext-types';

import { PrefixSumComputer } from './prefixSumComputer';

export class MirrorTextModel {
  protected _uri: Uri;
  protected _lines: string[];
  protected _eol: string;
  protected _versionId: number;
  protected _lineStarts: PrefixSumComputer | null;

  constructor(uri: Uri, lines: string[], eol: string, versionId: number) {
    this._uri = Uri.parse(uri.toString());
    this._lines = lines;
    this._eol = eol;
    this._versionId = versionId;
    this._lineStarts = null;
  }

  dispose(): void {
    this._lines.length = 0;
  }

  get version(): number {
    return this._versionId;
  }

  getText(): string {
    return this._lines.join(this._eol);
  }

  onEvents(e: IModelChangedEvent): void {
    if (e.eol && e.eol !== this._eol) {
      this._eol = e.eol;
      this._lineStarts = null;
    }

    // Update my lines
    const changes = e.changes;
    for (const change of changes) {
      this._acceptDeleteRange(change.range);
      this._acceptInsertText(new Position(change.range.startLineNumber, change.range.startColumn), change.text);
    }

    this._versionId = e.versionId;
  }

  protected _ensureLineStarts(): void {
    if (!this._lineStarts) {
      const eolLength = this._eol.length;
      const linesLength = this._lines.length;
      const lineStartValues = new Uint32Array(linesLength);
      for (let i = 0; i < linesLength; i++) {
        lineStartValues[i] = this._lines[i].length + eolLength;
      }
      this._lineStarts = new PrefixSumComputer(lineStartValues);
    }
  }

  /**
   * All changes to a line's text go through this method
   */
  private _setLineText(lineIndex: number, newValue: string): void {
    this._lines[lineIndex] = newValue;
    if (this._lineStarts) {
      // update prefix sum
      this._lineStarts.changeValue(lineIndex, this._lines[lineIndex].length + this._eol.length);
    }
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
        this._lines[range.startLineNumber - 1].substring(0, range.startColumn - 1) +
          this._lines[range.startLineNumber - 1].substring(range.endColumn - 1),
      );
      return;
    }

    // Take remaining text on last line and append it to remaining text on first line
    this._setLineText(
      range.startLineNumber - 1,
      this._lines[range.startLineNumber - 1].substring(0, range.startColumn - 1) +
        this._lines[range.endLineNumber - 1].substring(range.endColumn - 1),
    );

    // Delete middle lines
    this._lines.splice(range.startLineNumber, range.endLineNumber - range.startLineNumber);
    if (this._lineStarts) {
      // update prefix sum
      this._lineStarts.removeValues(range.startLineNumber, range.endLineNumber - range.startLineNumber);
    }
  }

  private _acceptInsertText(position: Position, insertText: string): void {
    if (insertText.length === 0) {
      // Nothing to insert
      return;
    }
    const insertLines = insertText.split(/\r\n|\r|\n/);
    if (insertLines.length === 1) {
      // Inserting text on one line
      this._setLineText(
        position.lineNumber - 1,
        this._lines[position.lineNumber - 1].substring(0, position.column - 1) +
          insertLines[0] +
          this._lines[position.lineNumber - 1].substring(position.column - 1),
      );
      return;
    }

    // Append overflowing text from first line to the end of text to insert
    insertLines[insertLines.length - 1] += this._lines[position.lineNumber - 1].substring(position.column - 1);

    // Delete overflowing text from first line and insert text on first line
    this._setLineText(
      position.lineNumber - 1,
      this._lines[position.lineNumber - 1].substring(0, position.column - 1) + insertLines[0],
    );

    // Insert new lines & store lengths
    const newLengths = new Uint32Array(insertLines.length - 1);
    for (let i = 1; i < insertLines.length; i++) {
      this._lines.splice(position.lineNumber + i - 1, 0, insertLines[i]);
      newLengths[i - 1] = insertLines[i].length + this._eol.length;
    }

    if (this._lineStarts) {
      // update prefix sum
      this._lineStarts.insertValues(position.lineNumber, newLengths);
    }
  }
}
