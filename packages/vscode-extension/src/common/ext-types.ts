import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { MarkdownString, isMarkdownString } from './markdown-string';
import { FileStat } from '@ali/ide-file-service/lib/common';

export enum Schemas {
  untitled = 'untitled',
}

export class Position {

  static Min(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (p.isBefore(result!)) {
        result = p;
      }
    }
    return result;
  }

  static Max(...positions: Position[]): Position {
    if (positions.length === 0) {
      throw new TypeError();
    }
    let result = positions[0];
    for (let i = 1; i < positions.length; i++) {
      const p = positions[i];
      if (p.isAfter(result!)) {
        result = p;
      }
    }
    return result;
  }

  static isPosition(other: any): other is Position {
    if (!other) {
      return false;
    }
    if (other instanceof Position) {
      return true;
    }
    const { line, character } = other as Position;
    if (typeof line === 'number' && typeof character === 'number') {
      return true;
    }
    return false;
  }

  private _line: number;
  private _character: number;

  get line(): number {
    return this._line;
  }

  get character(): number {
    return this._character;
  }

  constructor(line: number, character: number) {
    if (line < 0) {
      throw new Error('illegal argument: line must be non-negative');
    }
    if (character < 0) {
      throw new Error('illegal argument: character must be non-negative');
    }
    this._line = line;
    this._character = character;
  }

  isBefore(other: Position): boolean {
    if (this._line < other._line) {
      return true;
    }
    if (other._line < this._line) {
      return false;
    }
    return this._character < other._character;
  }

  isBeforeOrEqual(other: Position): boolean {
    if (this._line < other._line) {
      return true;
    }
    if (other._line < this._line) {
      return false;
    }
    return this._character <= other._character;
  }

  isAfter(other: Position): boolean {
    return !this.isBeforeOrEqual(other);
  }

  isAfterOrEqual(other: Position): boolean {
    return !this.isBefore(other);
  }

  isEqual(other: Position): boolean {
    return this._line === other._line && this._character === other._character;
  }

  compareTo(other: Position): number {
    if (this._line < other._line) {
      return -1;
    } else if (this._line > other.line) {
      return 1;
    } else {
      // equal line
      if (this._character < other._character) {
        return -1;
      } else if (this._character > other._character) {
        return 1;
      } else {
        // equal line and character
        return 0;
      }
    }
  }

  translate(change: { lineDelta?: number; characterDelta?: number; }): Position;
  translate(lineDelta?: number, characterDelta?: number): Position;
  translate(lineDeltaOrChange: number | undefined | { lineDelta?: number; characterDelta?: number; }, characterDelta: number = 0): Position {

    if (lineDeltaOrChange === null || characterDelta === null) {
      throw new Error('illegal argument');
    }

    let lineDelta: number;
    if (typeof lineDeltaOrChange === 'undefined') {
      lineDelta = 0;
    } else if (typeof lineDeltaOrChange === 'number') {
      lineDelta = lineDeltaOrChange;
    } else {
      lineDelta = typeof lineDeltaOrChange.lineDelta === 'number' ? lineDeltaOrChange.lineDelta : 0;
      characterDelta = typeof lineDeltaOrChange.characterDelta === 'number' ? lineDeltaOrChange.characterDelta : 0;
    }

    if (lineDelta === 0 && characterDelta === 0) {
      return this;
    }
    return new Position(this.line + lineDelta, this.character + characterDelta);
  }

  with(change: { line?: number; character?: number; }): Position;
  with(line?: number, character?: number): Position;
  with(lineOrChange: number | undefined | { line?: number; character?: number; }, character: number = this.character): Position {

    if (lineOrChange === null || character === null) {
      throw new Error('illegal argument');
    }

    let line: number;
    if (typeof lineOrChange === 'undefined') {
      line = this.line;

    } else if (typeof lineOrChange === 'number') {
      line = lineOrChange;

    } else {
      line = typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line;
      character = typeof lineOrChange.character === 'number' ? lineOrChange.character : this.character;
    }

    if (line === this.line && character === this.character) {
      return this;
    }
    return new Position(line, character);
  }

  toJSON(): any {
    return { line: this.line, character: this.character };
  }
}

export class Range {

  static isRange(thing: any): thing is vscode.Range {
    if (thing instanceof Range) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Position.isPosition((thing as Range).start)
      && Position.isPosition((thing as Range).end);
  }

  protected _start: Position;
  protected _end: Position;

  get start(): Position {
    return this._start;
  }

  get end(): Position {
    return this._end;
  }

  constructor(start: Position, end: Position);
  constructor(startLine: number, startColumn: number, endLine: number, endColumn: number);
  constructor(startLineOrStart: number | Position, startColumnOrEnd: number | Position, endLine?: number, endColumn?: number) {
    let start: Position | undefined;
    let end: Position | undefined;

    if (typeof startLineOrStart === 'number' && typeof startColumnOrEnd === 'number' && typeof endLine === 'number' && typeof endColumn === 'number') {
      start = new Position(startLineOrStart, startColumnOrEnd);
      end = new Position(endLine, endColumn);
    } else if (startLineOrStart instanceof Position && startColumnOrEnd instanceof Position) {
      start = startLineOrStart;
      end = startColumnOrEnd;
    }

    if (!start || !end) {
      throw new Error('Invalid arguments');
    }

    if (start.isBefore(end)) {
      this._start = start;
      this._end = end;
    } else {
      this._start = end;
      this._end = start;
    }
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Range) {
      return this.contains(positionOrRange._start)
        && this.contains(positionOrRange._end);

    } else if (positionOrRange instanceof Position) {
      if (positionOrRange.isBefore(this._start)) {
        return false;
      }
      if (this._end.isBefore(positionOrRange)) {
        return false;
      }
      return true;
    }
    return false;
  }

  isEqual(other: Range): boolean {
    return this._start.isEqual(other._start) && this._end.isEqual(other._end);
  }

  intersection(other: Range): Range | undefined {
    const start = Position.Max(other.start, this._start);
    const end = Position.Min(other.end, this._end);
    if (start.isAfter(end)) {
      // this happens when there is no overlap:
      // |-----|
      //          |----|
      return undefined;
    }
    return new Range(start, end);
  }

  union(other: Range): Range {
    if (this.contains(other)) {
      return this;
    } else if (other.contains(this)) {
      return other;
    }
    const start = Position.Min(other.start, this._start);
    const end = Position.Max(other.end, this.end);
    return new Range(start, end);
  }

  get isEmpty(): boolean {
    return this._start.isEqual(this._end);
  }

  get isSingleLine(): boolean {
    return this._start.line === this._end.line;
  }

  with(change: { start?: Position, end?: Position }): Range;
  with(start?: Position, end?: Position): Range;
  with(startOrChange: Position | undefined | { start?: Position, end?: Position }, end: Position = this.end): Range {

    if (startOrChange === null || end === null) {
      throw new Error('illegal argument');
    }

    let start: Position;
    if (!startOrChange) {
      start = this.start;

    } else if (Position.isPosition(startOrChange)) {
      start = startOrChange;

    } else {
      start = startOrChange.start || this.start;
      end = startOrChange.end || this.end;
    }

    if (start.isEqual(this._start) && end.isEqual(this.end)) {
      return this;
    }
    return new Range(start, end);
  }

  toJSON(): any {
    return [this.start, this.end];
  }
}

export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

export class RelativePattern {

  base: string;

  constructor(base: vscode.WorkspaceFolder | string, public pattern: string) {
    if (typeof base !== 'string') {
      if (!base || !URI.isUri(base.uri)) {
        throw new Error('illegalArgument: base');
      }
    }

    if (typeof pattern !== 'string') {
      throw new Error('illegalArgument: pattern');
    }

    this.base = typeof base === 'string' ? base : base.uri.fsPath;
  }

  pathToRelative(from: string, to: string): string {
    // return relative(from, to);
    return 'not implement!';
  }
}
export class Location {
  static isLocation(thing: any): thing is Location {
    if (thing instanceof Location) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange((thing as Location).range)
      && URI.isUri((thing as Location).uri);
  }

  uri: URI;
  range: Range;

  constructor(uri: URI, rangeOrPosition: Range | Position) {
    this.uri = uri;

    if (!rangeOrPosition) {
      // that's OK
    } else if (rangeOrPosition instanceof Range) {
      this.range = rangeOrPosition;
    } else if (rangeOrPosition instanceof Position) {
      this.range = new Range(rangeOrPosition, rangeOrPosition);
    } else {
      throw new Error('Illegal argument');
    }
  }

  toJSON(): any {
    return {
      uri: this.uri,
      range: this.range,
    };
  }
}

export class Disposable {
  private disposable: undefined | (() => void);

  // tslint:disable-next-line:no-any
  static from(...disposables: { dispose(): any }[]): Disposable {
    return new Disposable(() => {
      if (disposables) {
        for (const disposable of disposables) {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose();
          }
        }
      }
    });
  }

  constructor(func: () => void) {
    this.disposable = func;
  }
  /**
   * Dispose this object.
   */
  dispose(): void {
    if (this.disposable) {
      this.disposable();
      this.disposable = undefined;
    }
  }

  static create(func: () => void): Disposable {
    return new Disposable(func);
  }
}

export class Hover {

  public contents: MarkdownString[] | vscode.MarkedString[];
  public range?: Range;

  constructor(
    contents: MarkdownString | vscode.MarkedString | MarkdownString[] | vscode.MarkedString[],
    range?: Range,
  ) {
    if (!contents) {
      throw new Error('illegalArgument：contents must be defined');
    }
    if (Array.isArray(contents)) {
      this.contents = contents as MarkdownString[] | vscode.MarkedString[];
    } else if (isMarkdownString(contents)) {
      this.contents = [contents];
    } else {
      this.contents = [contents];
    }
    this.range = range;
  }
}

export class Uri extends URI {

}

export enum ConfigurationTarget {
  /**
   * Global configuration
  */
  Global = 1,

  /**
   * Workspace configuration
   */
  Workspace = 2,

  /**
   * Workspace folder configuration
   */
  WorkspaceFolder = 3,
}

export class Selection extends Range {

  static isSelection(thing: any): thing is Selection {
    if (thing instanceof Selection) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange(thing)
      && Position.isPosition((thing as Selection).anchor)
      && Position.isPosition((thing as Selection).active)
      && typeof (thing as Selection).isReversed === 'boolean';
  }

  private _anchor: Position;

  public get anchor(): Position {
    return this._anchor;
  }

  private _active: Position;

  public get active(): Position {
    return this._active;
  }

  constructor(anchor: Position, active: Position);
  constructor(anchorLine: number, anchorColumn: number, activeLine: number, activeColumn: number);
  constructor(anchorLineOrAnchor: number | Position, anchorColumnOrActive: number | Position, activeLine?: number, activeColumn?: number) {
    let anchor: Position | undefined;
    let active: Position | undefined;

    if (typeof anchorLineOrAnchor === 'number' && typeof anchorColumnOrActive === 'number' && typeof activeLine === 'number' && typeof activeColumn === 'number') {
      anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
      active = new Position(activeLine, activeColumn);
    } else if (anchorLineOrAnchor instanceof Position && anchorColumnOrActive instanceof Position) {
      anchor = anchorLineOrAnchor;
      active = anchorColumnOrActive;
    }

    if (!anchor || !active) {
      throw new Error('Invalid arguments');
    }

    super(anchor, active);

    this._anchor = anchor;
    this._active = active;
  }

  get isReversed(): boolean {
    return this._anchor === this._end;
  }

  toJSON() {
    return {
      start: this.start,
      end: this.end,
      active: this.active,
      anchor: this.anchor,
    };
  }
}

export enum TextEditorLineNumbersStyle {
  /**
   * Do not render the line numbers.
   */
  Off = 0,
  /**
   * Render the line numbers.
   */
  On = 1,
  /**
   * Render the line numbers with values relative to the primary cursor location.
   */
  Relative = 2,
}
