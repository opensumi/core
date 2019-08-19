import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { illegalArgument } from './utils';
import { CharCode } from './char-code';
import { FileOperationOptions, SymbolKind } from './model.api';
import { startsWithIgnoreCase } from '@ali/ide-core-common';
export * from './models';
export { URI as Uri} ;

export class DiagnosticRelatedInformation {
  location: Location;
  message: string;

  constructor(location: Location, message: string) {
    this.location = location;
    this.message = message;
  }
}

export class Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
  relatedInformation?: DiagnosticRelatedInformation[];
  tags?: DiagnosticTag[];

  constructor(range: Range, message: string, severity: DiagnosticSeverity = DiagnosticSeverity.Error) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

export class CodeAction {
  title: string;

  command?: vscode.Command;

  edit?: WorkspaceEdit;

  diagnostics?: Diagnostic[];

  kind?: CodeActionKind;

  constructor(title: string, kind?: CodeActionKind) {
    this.title = title;
    this.kind = kind;
  }
}

export enum ProgressLocation {

  /**
   * Show progress for the source control viewlet, as overlay for the icon and as progress bar
   * inside the viewlet (when visible). Neither supports cancellation nor discrete progress.
   */
  SourceControl = 1,

  /**
   * Show progress in the status bar of the editor. Neither supports cancellation nor discrete progress.
   */
  Window = 10,

  /**
   * Show progress as notification with an optional cancel button. Supports to show infinite and discrete progress.
   */
  Notification = 15,
}

export enum IndentAction {
  /**
   * Insert new line and copy the previous line's indentation.
   */
  None = 0,
  /**
   * Insert new line and indent once (relative to the previous line's indentation).
   */
  Indent = 1,
  /**
   * Insert two new lines:
   *  - the first one indented which will hold the cursor
   *  - the second one at the same indentation level
   */
  IndentOutdent = 2,
  /**
   * Insert new line and outdent once (relative to the previous line's indentation).
   */
  Outdent = 3,
}

export class CodeLens {

  range: Range;

  command: vscode.Command | undefined;

  constructor(range: Range, command?: vscode.Command) {
    this.range = range;
    this.command = command;
  }

  get isResolved(): boolean {
    return !!this.command;
  }
}

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

export class MarkdownString {

  value: string;
  isTrusted?: boolean;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(value: string): MarkdownString {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    this.value += value.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(code: string, language: string = ''): MarkdownString {
    this.value += '\n```';
    this.value += language;
    this.value += '\n';
    this.value += code;
    this.value += '\n```\n';
    return this;
  }
}

// tslint:disable-next-line:no-any
export function isMarkdownString(thing: any): thing is MarkdownString {
  if (thing instanceof MarkdownString) {
    return true;
  } else if (thing && typeof thing === 'object') {
    return typeof (thing as MarkdownString).value === 'string'
      && (typeof (thing as MarkdownString).isTrusted === 'boolean' || (thing as MarkdownString).isTrusted === void 0);
  }
  return false;
}

export class SnippetString {

  static isSnippetString(thing: {}): thing is SnippetString {
    if (thing instanceof SnippetString) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return typeof (thing as SnippetString).value === 'string';
  }

  private static _escape(value: string): string {
    return value.replace(/\$|}|\\/g, '\\$&');
  }

  private _tabstop: number = 1;

  value: string;

  constructor(value?: string) {
    this.value = value || '';
  }

  appendText(str: string): SnippetString {
    this.value += SnippetString._escape(str);
    return this;
  }

  appendTabstop(num: number = this._tabstop++): SnippetString {
    this.value += '$';
    this.value += num;
    return this;
  }

  appendPlaceholder(value: string | ((snippet: SnippetString) => void), num: number = this._tabstop++): SnippetString {

    if (typeof value === 'function') {
      const nested = new SnippetString();
      nested._tabstop = this._tabstop;
      value(nested);
      this._tabstop = nested._tabstop;
      value = nested.value;
    } else {
      value = SnippetString._escape(value);
    }

    this.value += '${';
    this.value += num;
    this.value += ':';
    this.value += value;
    this.value += '}';

    return this;
  }

  appendVariable(name: string, defaultValue?: string | ((snippet: SnippetString) => void)): SnippetString {

    if (typeof defaultValue === 'function') {
      const nested = new SnippetString();
      nested._tabstop = this._tabstop;
      defaultValue(nested);
      this._tabstop = nested._tabstop;
      defaultValue = nested.value;

    } else if (typeof defaultValue === 'string') {
      defaultValue = defaultValue.replace(/\$|}/g, '\\$&');
    }

    this.value += '${';
    this.value += name;
    if (defaultValue) {
      this.value += ':';
      this.value += defaultValue;
    }
    this.value += '}';

    return this;
  }
}

export class TextEdit {

  protected _range: Range;
  protected _newText: string;
  protected _newEol: EndOfLine;

  get range(): Range {
    return this._range;
  }

  set range(value: Range) {
    if (value && !Range.isRange(value)) {
      throw illegalArgument('range');
    }
    this._range = value;
  }

  get newText(): string {
    return this._newText || '';
  }

  set newText(value: string) {
    if (value && typeof value !== 'string') {
      throw illegalArgument('newText');
    }
    this._newText = value;
  }

  get newEol(): EndOfLine {
    return this._newEol;
  }

  set newEol(value: EndOfLine) {
    if (value && typeof value !== 'number') {
      throw illegalArgument('newEol');
    }
    this._newEol = value;
  }

  constructor(range: Range | undefined, newText: string | undefined) {
    this.range = range!;
    this.newText = newText!;
  }

  static isTextEdit(thing: {}): thing is TextEdit {
    if (thing instanceof TextEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange((thing as TextEdit).range)
      && typeof (thing as TextEdit).newText === 'string';
  }

  static replace(range: Range, newText: string): TextEdit {
    return new TextEdit(range, newText);
  }

  static insert(position: Position, newText: string): TextEdit {
    return TextEdit.replace(new Range(position, position), newText);
  }

  static delete(range: Range): TextEdit {
    return TextEdit.replace(range, '');
  }

  static setEndOfLine(eol: EndOfLine): TextEdit {
    const ret = new TextEdit(undefined, undefined);
    ret.newEol = eol;
    return ret;
  }
}

export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2,
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}
export class CompletionItem implements vscode.CompletionItem {

  label: string;
  kind: CompletionItemKind | undefined;
  detail?: string;
  documentation?: string | MarkdownString;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  insertText: string | SnippetString;
  keepWhitespace?: boolean;
  range: Range;
  commitCharacters?: string[];
  textEdit: TextEdit;
  additionalTextEdits: TextEdit[];
  command: vscode.Command;

  constructor(label: string, kind?: CompletionItemKind) {
    this.label = label;
    this.kind = kind;
  }

  toJSON(): any {
    return {
      label: this.label,
      kind: this.kind && CompletionItemKind[this.kind],
      detail: this.detail,
      documentation: this.documentation,
      sortText: this.sortText,
      filterText: this.filterText,
      preselect: this.preselect,
      insertText: this.insertText,
      textEdit: this.textEdit,
    };
  }
}

export class CompletionList {

  isIncomplete?: boolean;

  items: vscode.CompletionItem[];

  constructor(items: vscode.CompletionItem[] = [], isIncomplete: boolean = false) {
    this.items = items;
    this.isIncomplete = isIncomplete;
  }
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

export class ThemeColor {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

/**
 * These values match very carefully the values of `TrackedRangeStickiness`
 */
export enum DecorationRangeBehavior {
  /**
   * TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
   */
  OpenOpen = 0,
  /**
   * TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
   */
  ClosedClosed = 1,
  /**
   * TrackedRangeStickiness.GrowsOnlyWhenTypingBefore
   */
  OpenClosed = 2,
  /**
   * TrackedRangeStickiness.GrowsOnlyWhenTypingAfter
   */
  ClosedOpen = 3,
}

export class FoldingRange {
  start: number;
  end: number;
  kind?: FoldingRangeKind;

  constructor(start: number, end: number, kind?: FoldingRangeKind) {
    this.start = start;
    this.end = end;
    this.kind = kind;
  }
}

export enum FoldingRangeKind {
  Comment = 1,
  Imports = 2,
  Region = 3,
}
export class Color {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;

  constructor(red: number, green: number, blue: number, alpha: number) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }
}

export enum DocumentHighlightKind {
  Text = 0,
  Read = 1,
  Write = 2,
}

export class DocumentHighlight {

  public range: Range;
  public kind?: DocumentHighlightKind;

  constructor(
    range: Range,
    kind?: DocumentHighlightKind,
  ) {
    this.range = range;
    this.kind = kind;
  }
}

export class ColorPresentation {
  label: string;
  textEdit?: TextEdit;
  additionalTextEdits?: TextEdit[];

  constructor(label: string) {
    if (!label || typeof label !== 'string') {
      throw illegalArgument('label');
    }
    this.label = label;
  }
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum DiagnosticTag {
  Unnecessary = 1,
}

export class CodeActionKind {
  private static readonly sep = '.';

  public static readonly Empty = new CodeActionKind('');
  public static readonly QuickFix = CodeActionKind.Empty.append('quickfix');
  public static readonly Refactor = CodeActionKind.Empty.append('refactor');
  public static readonly RefactorExtract = CodeActionKind.Refactor.append('extract');
  public static readonly RefactorInline = CodeActionKind.Refactor.append('inline');
  public static readonly RefactorRewrite = CodeActionKind.Refactor.append('rewrite');
  public static readonly Source = CodeActionKind.Empty.append('source');
  public static readonly SourceOrganizeImports = CodeActionKind.Source.append('organizeImports');

  constructor(
    public readonly value: string,
  ) { }

  public append(parts: string): CodeActionKind {
    return new CodeActionKind(this.value ? this.value + CodeActionKind.sep + parts : parts);
  }

  public contains(other: CodeActionKind): boolean {
    return this.value === other.value || startsWithIgnoreCase(other.value, this.value + CodeActionKind.sep);
  }

  public intersects(other: CodeActionKind): boolean {
    return this.contains(other) || other.contains(this);
  }
}

export function isAsciiLetter(code: number): boolean {
  return isLowerAsciiLetter(code) || isUpperAsciiLetter(code);
}

export function isUpperAsciiLetter(code: number): boolean {
  return code >= CharCode.A && code <= CharCode.Z;
}

export function isLowerAsciiLetter(code: number): boolean {
  return code >= CharCode.a && code <= CharCode.z;
}

export enum MarkerSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
}

export enum MarkerTag {
  Unnecessary = 1,
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

export interface FileOperationOptions {
  overwrite?: boolean;
  ignoreIfExists?: boolean;
  ignoreIfNotExists?: boolean;
  recursive?: boolean;
}

export interface FileOperation {
  _type: 1;
  from: URI | undefined;
  to: URI | undefined;
  options?: FileOperationOptions;
}

export interface FileTextEdit {
  _type: 2;
  uri: URI;
  edit: TextEdit;
}

export class WorkspaceEdit implements vscode.WorkspaceEdit {

  private _edits = new Array<FileOperation | FileTextEdit | undefined>();

  renameFile(from: vscode.Uri, to: vscode.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void {
    this._edits.push({ _type: 1, from, to, options });
  }

  createFile(uri: vscode.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): void {
    this._edits.push({ _type: 1, from: undefined, to: uri, options });
  }

  deleteFile(uri: vscode.Uri, options?: { recursive?: boolean, ignoreIfNotExists?: boolean }): void {
    this._edits.push({ _type: 1, from: uri, to: undefined, options });
  }

  replace(uri: URI, range: Range, newText: string): void {
    this._edits.push({ _type: 2, uri, edit: new TextEdit(range, newText) });
  }

  insert(resource: URI, position: Position, newText: string): void {
    this.replace(resource, new Range(position, position), newText);
  }

  delete(resource: URI, range: Range): void {
    this.replace(resource, range, '');
  }

  has(uri: URI): boolean {
    for (const edit of this._edits) {
      if (edit && edit._type === 2 && edit.uri.toString() === uri.toString()) {
        return true;
      }
    }
    return false;
  }

  set(uri: URI, edits: TextEdit[]): void {
    if (!edits) {
      // remove all text edits for `uri`
      for (let i = 0; i < this._edits.length; i++) {
        const element = this._edits[i];
        if (element && element._type === 2 && element.uri.toString() === uri.toString()) {
          this._edits[i] = undefined;
        }
      }
      this._edits = this._edits.filter((e) => !!e);
    } else {
      // append edit to the end
      for (const edit of edits) {
        if (edit) {
          this._edits.push({ _type: 2, uri, edit });
        }
      }
    }
  }

  get(uri: URI): TextEdit[] {
    const res: TextEdit[] = [];
    for (const candidate of this._edits) {
      if (candidate && candidate._type === 2 && candidate.uri.toString() === uri.toString()) {
        res.push(candidate.edit);
      }
    }
    if (res.length === 0) {
      return undefined!;
    }
    return res;
  }

  entries(): [URI, TextEdit[]][] {
    const textEdits = new Map<string, [URI, TextEdit[]]>();
    for (const candidate of this._edits) {
      if (candidate && candidate._type === 2) {
        let textEdit = textEdits.get(candidate.uri.toString());
        if (!textEdit) {
          textEdit = [candidate.uri, []];
          textEdits.set(candidate.uri.toString(), textEdit);
        }
        textEdit[1].push(candidate.edit);
      }
    }
    const result: [URI, TextEdit[]][] = [];
    textEdits.forEach((v) => result.push(v));
    return result;
  }

  _allEntries(): ([URI, TextEdit[]] | [URI, URI, FileOperationOptions])[] {
    const res: ([URI, TextEdit[]] | [URI, URI, FileOperationOptions])[] = [];
    for (const edit of this._edits) {
      if (!edit) {
        continue;
      }
      if (edit._type === 1) {
        res.push([edit.from!, edit.to!, edit.options!]);
      } else {
        res.push([edit.uri, [edit.edit]]);
      }
    }
    return res;
  }

  get size(): number {
    return this.entries().length;
  }

  // tslint:disable-next-line:no-any
  toJSON(): any {
    return this.entries();
  }
}

export class DocumentLink {
  range: Range;
  target: URI;

  constructor(range: Range, target: URI) {
    if (target && !(target instanceof URI)) {
      throw illegalArgument('target');
    }
    if (!Range.isRange(range) || range.isEmpty) {
      throw illegalArgument('range');
    }
    this.range = range;
    this.target = target;
  }
}

/**
 * Represents the alignment of status bar items.
 */
export enum StatusBarAlignment {

  /**
   * Aligned to the left side.
   */
  Left = 1,

  /**
   * Aligned to the right side.
   */
  Right = 2,
}

/**
 * A status bar item is a status bar contribution that can
 * show text and icons and run a command on click.
 */
export interface StatusBarItem {

  /**
   * The alignment of this item.
   */
  readonly alignment: StatusBarAlignment;

  /**
   * The priority of this item. Higher value means the item should
   * be shown more to the left.
   */
  readonly priority?: number;

  /**
   * The text to show for the entry. You can embed icons in the text by leveraging the syntax:
   *
   * `My text $(icon-name) contains icons like $(icon-name) this one.`
   *
   * Where the icon-name is taken from the [octicon](https://octicons.github.com) icon set, e.g.
   * `light-bulb`, `thumbsup`, `zap` etc.
   */
  text: string;

  /**
   * The tooltip text when you hover over this entry.
   */
  tooltip: string | undefined;

  /**
   * The foreground color for this entry.
   */
  color: string | ThemeColor | undefined;

  /**
   * The identifier of a command to run on click. The command must be
   * [known](#commands.getCommands).
   */
  command: string | undefined;

  /**
   * Shows the entry in the status bar.
   */
  show(): void;

  /**
   * Hide the entry in the status bar.
   */
  hide(): void;

  /**
   * Dispose and free associated resources. Call
   * [hide](#StatusBarItem.hide).
   */
  dispose(): void;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
}

export interface OutputChannel {

  /**
   * The name of this output channel.
   */
  readonly name: string;

  /**
   * Append the given value to the channel.
   *
   * @param value
   */
  append(value: string): void;

  /**
   * Append the given value and a line feed character
   * to the channel.
   *
   * @param value
   */
  appendLine(value: string): void;

  /**
   * Removes all output from the channel.
   */
  clear(): void;

  /**
   * Reveal this channel in the UI.
   *
   * @param preserveFocus When 'true' the channel will not take focus.
   */
  show(preserveFocus?: boolean): void;

  /**
   * Hide this channel from the UI.
   */
  hide(): void;

  /**
   * Dispose and free associated resources.
   */
  dispose(): void;
}

export class SymbolInformation {

  static validate(candidate: SymbolInformation): void {
    if (!candidate.name) {
      throw new Error('Should provide a name inside candidate field');
    }
  }

  name: string;
  location: Location;
  kind: SymbolKind;
  containerName: undefined | string;
  constructor(name: string, kind: SymbolKind, containerName: string, location: Location);
  constructor(name: string, kind: SymbolKind, range: Range, uri?: URI, containerName?: string);
  constructor(name: string, kind: SymbolKind, rangeOrContainer: string | Range, locationOrUri?: Location | URI, containerName?: string) {
    this.name = name;
    this.kind = kind;
    this.containerName = containerName;

    if (typeof rangeOrContainer === 'string') {
      this.containerName = rangeOrContainer;
    }

    if (locationOrUri instanceof Location) {
      this.location = locationOrUri;
    } else if (rangeOrContainer instanceof Range) {
      this.location = new Location(locationOrUri!, rangeOrContainer);
    }

    SymbolInformation.validate(this);
  }

  // tslint:disable-next-line:no-any
  toJSON(): any {
    return {
      name: this.name,
      kind: SymbolKind[this.kind],
      location: this.location,
      containerName: this.containerName,
    };
  }
}

export class DocumentSymbol {

  static validate(candidate: DocumentSymbol): void {
    if (!candidate.name) {
      throw new Error('Should provide a name inside candidate field');
    }
    if (!candidate.range.contains(candidate.selectionRange)) {
      throw new Error('selectionRange must be contained in fullRange');
    }
    if (candidate.children) {
      candidate.children.forEach(DocumentSymbol.validate);
    }
  }

  name: string;
  detail: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children: DocumentSymbol[];

  constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range) {
    this.name = name;
    this.detail = detail;
    this.kind = kind;
    this.range = range;
    this.selectionRange = selectionRange;
    this.children = [];

    DocumentSymbol.validate(this);
  }
}
/**
   * How a [`SignatureHelpProvider`](#SignatureHelpProvider) was triggered.
   */
export enum SignatureHelpTriggerKind {
  /**
   * Signature help was invoked manually by the user or by a command.
   */
  Invoke = 1,

  /**
   * Signature help was triggered by a trigger character.
   */
  TriggerCharacter = 2,

  /**
   * Signature help was triggered by the cursor moving or by the document content changing.
   */
  ContentChange = 3,
}
export class ParameterInformation {
  label: string;
  documentation?: string | MarkdownString;

  constructor(label: string, documentation?: string | MarkdownString) {
    this.label = label;
    this.documentation = documentation;
  }
}

export class SignatureInformation {
  label: string;
  documentation?: string | MarkdownString;
  parameters: ParameterInformation[];

  constructor(label: string, documentation?: string | MarkdownString) {
    this.label = label;
    this.documentation = documentation;
  }
}

export class SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

// 树节点状态
export enum TreeItemCollapsibleState {
  // 只能被折叠的节点，不存在子节点
  None = 0,
  // 折叠的节点
  Collapsed = 1,
  // 展开的节点
  Expanded = 2,
}

/**
	* A reference to a named icon. Currently only [File](#ThemeIcon.File) and [Folder](#ThemeIcon.Folder) are supported.
	* Using a theme icon is preferred over a custom icon as it gives theme authors the possibility to change the icons.
*/
export class ThemeIcon {
  /**
   * Reference to a icon representing a file. The icon is taken from the current file icon theme or a placeholder icon.
   */
  static readonly File: ThemeIcon;

  /**
   * Reference to a icon representing a folder. The icon is taken from the current file icon theme or a placeholder icon.
   */
  static readonly Folder: ThemeIcon;

  private constructor(id: string) {}
}

export class TreeItem {
  /**
   * A human-readable string describing this item. When `falsy`, it is derived from [resourceUri](#TreeItem.resourceUri).
   */
  label?: string;

  /**
   * Optional id for the tree item that has to be unique across tree. The id is used to preserve the selection and expansion state of the tree item.
   *
   * If not provided, an id is generated using the tree item's label. **Note** that when labels change, ids will change and that selection and expansion state cannot be kept stable anymore.
   */
  id?: string;

  /**
   * The icon path or [ThemeIcon](#ThemeIcon) for the tree item.
   * When `falsy`, [Folder Theme Icon](#ThemeIcon.Folder) is assigned, if item is collapsible otherwise [File Theme Icon](#ThemeIcon.File).
   * When a [ThemeIcon](#ThemeIcon) is specified, icon is derived from the current file icon theme for the specified theme icon using [resourceUri](#TreeItem.resourceUri) (if provided).
   */
  iconPath?: string | URI | { light: string | URI; dark: string | URI } | ThemeIcon;

  /**
   * A human readable string which is rendered less prominent.
   * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
   */
  description?: string | boolean;

  /**
   * The [uri](#Uri) of the resource representing this item.
   *
   * Will be used to derive the [label](#TreeItem.label), when it is not provided.
   * Will be used to derive the icon from current icon theme, when [iconPath](#TreeItem.iconPath) has [ThemeIcon](#ThemeIcon) value.
   */
  resourceUri?: URI;

  /**
   * The tooltip text when you hover over this item.
   */
  tooltip?: string | undefined;

  /**
   * The [command](#Command) that should be executed when the tree item is selected.
   */
  command?: vscode.Command;

  /**
   * [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item.
   */
  collapsibleState?: TreeItemCollapsibleState;

  /**
   * Context value of the tree item. This can be used to contribute item specific actions in the tree.
   * For example, a tree item is given a context value as `folder`. When contributing actions to `view/item/context`
   * using `menus` extension point, you can specify context value for key `viewItem` in `when` expression like `viewItem == folder`.
   * ```
   *	"contributes": {
   *		"menus": {
   *			"view/item/context": [
   *				{
   *					"command": "extension.deleteFolder",
   *					"when": "viewItem == folder"
   *				}
   *			]
   *		}
   *	}
   * ```
   * This will show action `extension.deleteFolder` only for items with `contextValue` is `folder`.
   */
  contextValue?: string;

  /**
   * @param labelOrUri A human-readable string describing this item or [uri](#Uri) of the resource representing this item.
   * @param collapsibleState [TreeItemCollapsibleState](#TreeItemCollapsibleState) of the tree item. Default is [TreeItemCollapsibleState.None](#TreeItemCollapsibleState.None)
   */
  constructor(labelOrUri: string | URI, collapsibleState?: TreeItemCollapsibleState) {}
}

export enum LogLevel {
  Trace = 1,
  Debug = 2,
  Info = 3,
  Warning = 4,
  Error = 5,
  Critical = 6,
  Off = 7,
}

export enum SourceControlInputBoxValidationType {
  Error = 0,
  Warning = 1,
  Information = 2,
}
