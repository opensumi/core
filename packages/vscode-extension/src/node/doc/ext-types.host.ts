import * as vscode from 'vscode';

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
