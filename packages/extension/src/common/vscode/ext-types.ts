import type vscode from 'vscode';

import { Uri, UriUtils } from '@opensumi/ide-core-common';
import { startsWithIgnoreCase, uuid, es5ClassCompat, isStringArray } from '@opensumi/ide-core-common';

import { FileOperationOptions } from './model.api';
import { escapeCodicons } from './models/html-content';
import { illegalArgument } from './utils';

export { UriComponents } from './models/uri';

// vscode 中的 uri 存在 static 方法。。内容是 vscode-uri 的 Utils 中的内容...
Object.keys(UriUtils).forEach((funcName) => {
  Uri[funcName] = UriUtils[funcName];
});

export { Uri };
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

@es5ClassCompat
export class Range {
  static isRange(thing: any): thing is vscode.Range {
    if (thing instanceof Range) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Position.isPosition((thing as Range).start) && Position.isPosition((thing as Range).end);
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
  constructor(
    startLineOrStart: number | Position,
    startColumnOrEnd: number | Position,
    endLine?: number,
    endColumn?: number,
  ) {
    let start: Position | undefined;
    let end: Position | undefined;

    if (
      typeof startLineOrStart === 'number' &&
      typeof startColumnOrEnd === 'number' &&
      typeof endLine === 'number' &&
      typeof endColumn === 'number'
    ) {
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
      return this.contains(positionOrRange._start) && this.contains(positionOrRange._end);
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

  with(change: { start?: Position; end?: Position }): Range;
  with(start?: Position, end?: Position): Range;
  with(startOrChange: Position | undefined | { start?: Position; end?: Position }, end: Position = this.end): Range {
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

export enum LanguageStatusSeverity {
  Information = 0,
  Warning = 1,
  Error = 2,
}

@es5ClassCompat
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

@es5ClassCompat
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

  translate(change: { lineDelta?: number; characterDelta?: number }): Position;
  translate(lineDelta?: number, characterDelta?: number): Position;
  translate(
    lineDeltaOrChange: number | undefined | { lineDelta?: number; characterDelta?: number },
    characterDelta = 0,
  ): Position {
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

  with(change: { line?: number; character?: number }): Position;
  with(line?: number, character?: number): Position;
  with(
    lineOrChange: number | undefined | { line?: number; character?: number },
    character: number = this.character,
  ): Position {
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

@es5ClassCompat
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

export enum EndOfLine {
  LF = 1,
  CRLF = 2,
}

@es5ClassCompat
export class RelativePattern {
  base: string;

  constructor(base: vscode.WorkspaceFolder | string, public pattern: string) {
    if (typeof base !== 'string') {
      if (!base || !Uri.isUri(base.uri)) {
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

@es5ClassCompat
export class Location {
  static isLocation(thing: any): thing is Location {
    if (thing instanceof Location) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange((thing as Location).range) && Uri.isUri((thing as Location).uri);
  }

  uri: Uri;
  range: Range;

  constructor(uri: Uri, rangeOrPosition: Range | Position) {
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

@es5ClassCompat
export class DiagnosticRelatedInformation {
  location: Location;
  message: string;

  constructor(location: Location, message: string) {
    this.location = location;
    this.message = message;
  }
}

@es5ClassCompat
export class Disposable {
  private disposable: undefined | (() => void);

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

@es5ClassCompat
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
    } else if (MarkdownString.isMarkdownString(contents)) {
      this.contents = [contents];
    } else {
      this.contents = [contents];
    }
    this.range = range;
  }
}

@es5ClassCompat
export class SnippetString {
  static isSnippetString(thing: any): thing is SnippetString {
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

  private _tabstop = 1;

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

  appendChoice(values: string[], num: number = this._tabstop++): SnippetString {
    const value = values.map((s) => s.replace(/\$|}|\\|,/g, '\\$&')).join(',');

    this.value += '${';
    this.value += num;
    this.value += '|';
    this.value += value;
    this.value += '|}';

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

@es5ClassCompat
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

  static isTextEdit(thing: any): thing is TextEdit {
    if (thing instanceof TextEdit) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return Range.isRange((thing as TextEdit).range) && typeof (thing as TextEdit).newText === 'string';
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
    const ret = new TextEdit(new Range(new Position(0, 0), new Position(0, 0)), '');
    ret.newEol = eol;
    return ret;
  }

  toJSON(): any {
    return {
      range: this.range,
      newText: this.newText,
      newEol: this._newEol,
    };
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
  User = 25,
  Issue = 26,
}
/**
 * Completion item tags are extra annotations that tweak the rendering of a completion
 * item.
 */
export enum CompletionItemTag {
  /**
   * Render a completion as obsolete, usually using a strike-out.
   */
  Deprecated = 1,
}

@es5ClassCompat
export class MarkdownString {
  value: string;
  isTrusted?: boolean;
  readonly supportThemeIcons?: boolean;

  constructor(value?: string, supportThemeIcons = false) {
    this.value = value ?? '';
    this.supportThemeIcons = supportThemeIcons;
  }

  appendText(value: string): MarkdownString {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    this.value += (this.supportThemeIcons ? escapeCodicons(value) : value)
      .replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&')
      .replace(/\n/, '\n\n');

    return this;
  }

  appendMarkdown(value: string): MarkdownString {
    this.value += value;

    return this;
  }

  appendCodeblock(code: string, language = ''): MarkdownString {
    this.value += '\n```';
    this.value += language;
    this.value += '\n';
    this.value += code;
    this.value += '\n```\n';
    return this;
  }

  static isMarkdownString(thing: any): thing is MarkdownString {
    if (thing instanceof MarkdownString) {
      return true;
    }
    return thing && thing.appendCodeblock && thing.appendMarkdown && thing.appendText && thing.value !== undefined;
  }
}

export interface CompletionItemLabel {
  label: string;
  detail?: string;
  description?: string;
}

@es5ClassCompat
export class CompletionItem implements vscode.CompletionItem {
  label: string | CompletionItemLabel;
  label2?: CompletionItemLabel;
  kind?: vscode.CompletionItemKind;
  tags?: CompletionItemTag[];
  detail?: string;
  documentation?: string | vscode.MarkdownString;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  insertText: string | SnippetString;
  keepWhitespace?: boolean;
  range?: Range | { inserting: Range; replacing: Range };
  commitCharacters?: string[];
  textEdit?: TextEdit;
  additionalTextEdits: TextEdit[];
  command?: vscode.Command;

  constructor(label: string | CompletionItemLabel, kind?: vscode.CompletionItemKind) {
    this.label = label;
    this.kind = kind;
  }

  toJSON(): any {
    return {
      label: this.label,
      label2: this.label2,
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

@es5ClassCompat
export class CompletionList {
  isIncomplete?: boolean;

  items: vscode.CompletionItem[];

  constructor(items: vscode.CompletionItem[] = [], isIncomplete = false) {
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

@es5ClassCompat
export class ThemeColor {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

@es5ClassCompat
export class FileDecoration {
  static validate(d: FileDecoration): void {
    if (d.badge && d.badge.length !== 1 && d.badge.length !== 2) {
      throw new Error("The 'badge'-property must be undefined or a short character");
    }
    if (!d.color && !d.badge && !d.tooltip) {
      throw new Error('The decoration is empty');
    }
  }

  badge?: string;
  tooltip?: string;
  color?: vscode.ThemeColor;
  propagate?: boolean;

  constructor(badge?: string, tooltip?: string, color?: ThemeColor) {
    this.badge = badge;
    this.tooltip = tooltip;
    this.color = color;
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

@es5ClassCompat
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

@es5ClassCompat
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

@es5ClassCompat
export class DocumentHighlight {
  public range: Range;
  public kind?: DocumentHighlightKind;

  constructor(range: Range, kind: DocumentHighlightKind = DocumentHighlightKind.Text) {
    this.range = range;
    this.kind = kind;
  }
}

@es5ClassCompat
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
  Deprecated = 2,
}

@es5ClassCompat
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
  public static readonly SourceFixAll = CodeActionKind.Source.append('sourceFixAll');

  constructor(public readonly value: string) {}

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

export enum CodeActionTriggerKind {
  Invoke = 1,
  Automatic = 2,
}

@es5ClassCompat
export class CodeAction {
  title: string;

  command?: vscode.Command;

  edit?: WorkspaceEdit;

  diagnostics?: Diagnostic[];

  kind?: CodeActionKind;

  isPreferred?: boolean;

  constructor(title: string, kind?: CodeActionKind) {
    this.title = title;
    this.kind = kind;
  }
}

@es5ClassCompat
export class Selection extends Range {
  static isSelection(thing: any): thing is Selection {
    if (thing instanceof Selection) {
      return true;
    }
    if (!thing) {
      return false;
    }
    return (
      Range.isRange(thing) &&
      Position.isPosition((thing as Selection).anchor) &&
      Position.isPosition((thing as Selection).active) &&
      typeof (thing as Selection).isReversed === 'boolean'
    );
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
  constructor(
    anchorLineOrAnchor: number | Position,
    anchorColumnOrActive: number | Position,
    activeLine?: number,
    activeColumn?: number,
  ) {
    let anchor: Position | undefined;
    let active: Position | undefined;

    if (
      typeof anchorLineOrAnchor === 'number' &&
      typeof anchorColumnOrActive === 'number' &&
      typeof activeLine === 'number' &&
      typeof activeColumn === 'number'
    ) {
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

export interface FileOperation {
  _type: WorkspaceEditType.File;
  from: Uri | undefined;
  to: Uri | undefined;
  options?: FileOperationOptions;
  metadata?: vscode.WorkspaceEditEntryMetadata;
}

export interface FileTextEdit {
  _type: WorkspaceEditType.Text;
  uri: Uri;
  edit: TextEdit;
  metadata?: vscode.WorkspaceEditEntryMetadata;
}

type WorkspaceEditEntry = FileOperation | FileTextEdit;

export const enum WorkspaceEditType {
  File = 1,
  Text = 2,
  // Cell = 3, // not supported yet
}

@es5ClassCompat
export class WorkspaceEdit implements vscode.WorkspaceEdit {
  private _edits = new Array<WorkspaceEditEntry>();

  renameFile(
    from: vscode.Uri,
    to: vscode.Uri,
    options?: { overwrite?: boolean; ignoreIfExists?: boolean },
    metadata?: vscode.WorkspaceEditEntryMetadata,
  ): void {
    this._edits.push({ _type: WorkspaceEditType.File, from, to, options, metadata });
  }

  createFile(
    uri: vscode.Uri,
    options?: { overwrite?: boolean; ignoreIfExists?: boolean },
    metadata?: vscode.WorkspaceEditEntryMetadata,
  ): void {
    this._edits.push({ _type: WorkspaceEditType.File, from: undefined, to: uri, options, metadata });
  }

  deleteFile(
    uri: vscode.Uri,
    options?: { recursive?: boolean; ignoreIfNotExists?: boolean },
    metadata?: vscode.WorkspaceEditEntryMetadata,
  ): void {
    this._edits.push({ _type: WorkspaceEditType.File, from: uri, to: undefined, options, metadata });
  }

  replace(uri: Uri, range: Range, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata): void {
    this._edits.push({ _type: WorkspaceEditType.Text, uri, edit: new TextEdit(range, newText), metadata });
  }

  insert(resource: Uri, position: Position, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata): void {
    this.replace(resource, new Range(position, position), newText, metadata);
  }

  delete(resource: Uri, range: Range, metadata?: vscode.WorkspaceEditEntryMetadata): void {
    this.replace(resource, range, '', metadata);
  }

  has(uri: Uri): boolean {
    for (const edit of this._edits) {
      if (edit && edit._type === WorkspaceEditType.Text && edit.uri.toString() === uri.toString()) {
        return true;
      }
    }
    return false;
  }

  set(uri: Uri, edits: TextEdit[]): void {
    if (!edits) {
      // remove all text edits for `uri`
      this._edits = this._edits.filter(
        (element) =>
          !(element && element._type === WorkspaceEditType.Text && element.uri.toString() === uri.toString()),
      );
    } else {
      // append edit to the end
      for (const edit of edits) {
        if (edit) {
          this._edits.push({ _type: WorkspaceEditType.Text, uri, edit });
        }
      }
    }
  }

  get(uri: Uri): TextEdit[] {
    const res: TextEdit[] = [];
    for (const candidate of this._edits) {
      if (candidate && candidate._type === WorkspaceEditType.Text && candidate.uri.toString() === uri.toString()) {
        res.push(candidate.edit);
      }
    }
    return res;
  }

  entries(): [Uri, TextEdit[]][] {
    const textEdits = new Map<string, [Uri, TextEdit[]]>();
    for (const candidate of this._edits) {
      if (candidate && candidate._type === WorkspaceEditType.Text) {
        let textEdit = textEdits.get(candidate.uri.toString());
        if (!textEdit) {
          textEdit = [candidate.uri, []];
          textEdits.set(candidate.uri.toString(), textEdit);
        }
        textEdit[1].push(candidate.edit);
      }
    }
    return [...textEdits.values()];
  }

  allEntries(): ReadonlyArray<FileOperation | FileTextEdit> {
    return this._edits;
  }

  get size(): number {
    return this.entries().length;
  }

  toJSON(): any {
    return this.entries();
  }
}

@es5ClassCompat
export class DocumentLink {
  range: Range;
  target?: Uri;
  tooltip?: string;

  constructor(range: Range, target: Uri | undefined) {
    if (target && !Uri.isUri(target)) {
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

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
  keys: string[];
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

export interface WindowState {
  focused: boolean;
}

@es5ClassCompat
export class SymbolInformation {
  static validate(candidate: SymbolInformation): void {
    if (!candidate.name) {
      throw new Error('Should provide a name inside candidate field');
    }
  }

  name: string;
  location: Location;
  kind: SymbolKind;
  tags?: SymbolTag[];
  containerName: undefined | string;
  constructor(name: string, kind: SymbolKind, containerName: string | undefined, location: Location);
  constructor(name: string, kind: SymbolKind, range: Range, uri?: Uri, containerName?: string);
  constructor(
    name: string,
    kind: SymbolKind,
    rangeOrContainer: string | undefined | Range,
    locationOrUri?: Location | Uri,
    containerName?: string,
  ) {
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

  toJSON(): any {
    return {
      name: this.name,
      kind: SymbolKind[this.kind],
      location: this.location,
      containerName: this.containerName,
    };
  }
}

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

@es5ClassCompat
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
  tags?: SymbolTag[];
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

@es5ClassCompat
export class ParameterInformation {
  label: string | [number, number];
  documentation?: string | vscode.MarkdownString;

  constructor(label: string | [number, number], documentation?: string | vscode.MarkdownString) {
    this.label = label;
    this.documentation = documentation;
  }
}

@es5ClassCompat
export class SignatureInformation {
  label: string;
  documentation?: string | vscode.MarkdownString;
  parameters: ParameterInformation[];
  activeParameter?: number;

  constructor(label: string, documentation?: string | vscode.MarkdownString) {
    this.label = label;
    this.documentation = documentation;
    this.parameters = [];
  }
}

@es5ClassCompat
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
@es5ClassCompat
export class ThemeIcon {
  static File: ThemeIcon;
  static Folder: ThemeIcon;

  readonly id: string;
  readonly color?: ThemeColor;

  constructor(id: string, color?: ThemeColor) {
    this.id = id;
    this.color = color;
  }
}
ThemeIcon.File = new ThemeIcon('file');
ThemeIcon.Folder = new ThemeIcon('folder');

@es5ClassCompat
export class TreeItem {
  label?: string | vscode.TreeItemLabel;
  resourceUri?: Uri;
  iconPath?: string | Uri | { light: string | Uri; dark: string | Uri };
  command?: vscode.Command;
  contextValue?: string;
  tooltip?: string;

  constructor(label: string | vscode.TreeItemLabel, collapsibleState?: vscode.TreeItemCollapsibleState);
  constructor(
    arg1: string | vscode.TreeItemLabel | Uri,
    public collapsibleState: vscode.TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {
    if (arg1 instanceof Uri) {
      this.resourceUri = arg1;
    } else {
      this.label = arg1;
    }
  }
}

@es5ClassCompat
export class TreeItem2 extends TreeItem {
  // 该类已经标准化为 TreeItem，但是还有存量插件在使用
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

@es5ClassCompat
export class ColorInformation {
  range: Range;
  color: Color;

  constructor(range: Range, color: Color) {
    if (color && !(color instanceof Color)) {
      throw illegalArgument('color');
    }
    if (!Range.isRange(range)) {
      throw illegalArgument('range');
    }
    this.range = range;
    this.color = color;
  }
}

// Debug

@es5ClassCompat
export class DebugAdapterExecutable {
  readonly command: string;
  readonly args: string[];
  readonly options;

  constructor(command: string, args: string[], options?) {
    this.command = command;
    this.args = args || [];
    this.options = options;
  }
}

/**
 * Represents a debug adapter running as a socket based server.
 */
@es5ClassCompat
export class DebugAdapterServer {
  /**
   * The port.
   */
  readonly port: number;

  /**
   * The host.
   */
  readonly host?: string;

  /**
   * Create a description for a debug adapter running as a socket based server.
   */
  constructor(port: number, host?: string) {
    this.port = port;
    this.host = host;
  }
}

@es5ClassCompat
export class DebugAdapterNamedPipeServer implements vscode.DebugAdapterNamedPipeServer {
  constructor(public readonly path: string) {}
}

@es5ClassCompat
export class DebugAdapterInlineImplementation implements vscode.DebugAdapterInlineImplementation {
  readonly implementation: vscode.DebugAdapter;

  constructor(impl: vscode.DebugAdapter) {
    this.implementation = impl;
  }
}

@es5ClassCompat
export class SelectionRange {
  range: Range;
  parent?: SelectionRange;

  constructor(range: Range, parent?: SelectionRange) {
    this.range = range;
    this.parent = parent;

    if (parent && !parent.range.contains(this.range)) {
      throw new Error('Invalid argument: parent must contain this range');
    }
  }
}

/**
 * The base class of all breakpoint types.
 */
@es5ClassCompat
export class Breakpoint {
  /**
   * Is breakpoint enabled.
   */
  enabled: boolean;
  /**
   * An optional expression for conditional breakpoints.
   */
  condition?: string;
  /**
   * An optional expression that controls how many hits of the breakpoint are ignored.
   */
  hitCondition?: string;
  /**
   * An optional message that gets logged when this breakpoint is hit. Embedded expressions within {} are interpolated by the debug adapter.
   */
  logMessage?: string;

  protected constructor(enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
    this.enabled = enabled || false;
    this.condition = condition;
    this.hitCondition = hitCondition;
    this.logMessage = logMessage;
  }

  private _id: string | undefined;
  /**
   * The unique ID of the breakpoint.
   */
  get id(): string {
    if (!this._id) {
      this._id = uuid();
    }
    return this._id;
  }
}

/**
 * A breakpoint specified by a source location.
 */
@es5ClassCompat
export class SourceBreakpoint extends Breakpoint {
  /**
   * The source and line position of this breakpoint.
   */
  location: Location;

  /**
   * Create a new breakpoint for a source location.
   */
  constructor(location: Location, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
    super(enabled, condition, hitCondition, logMessage);
    this.location = location;
  }
}

/**
 * A breakpoint specified by a function name.
 */
@es5ClassCompat
export class FunctionBreakpoint extends Breakpoint {
  /**
   * The name of the function to which this breakpoint is attached.
   */
  functionName: string;

  /**
   * Create a new function breakpoint.
   */
  constructor(functionName: string, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string) {
    super(enabled, condition, hitCondition, logMessage);
    this.functionName = functionName;
  }
}

export interface QuickInputButton {
  readonly iconPath: Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;
  readonly tooltip?: string | undefined;
}

// #region debug
export enum DebugConsoleMode {
  /**
   * Debug session should have a separate debug console.
   */
  Separate = 0,

  /**
   * Debug session should share debug console with its parent session.
   * This value has no effect for sessions which do not have a parent session.
   */
  MergeWithParent = 1,
}

export enum DebugConfigurationProviderTriggerKind {
  /**
   *  `DebugConfigurationProvider.provideDebugConfigurations` is called to provide the initial debug configurations for a newly created launch.json.
   */
  Initial = 1,
  /**
   * `DebugConfigurationProvider.provideDebugConfigurations` is called to provide dynamically generated debug configurations when the user asks for them through the UI (e.g. via the "Select and Start Debugging" command).
   */
  Dynamic = 2,
}

// #endregion

@es5ClassCompat
export class QuickInputButtons {
  static readonly Back: QuickInputButton = {
    iconPath: {
      id: 'Back',
    },
    tooltip: 'Back',
  };
}

export enum TextDocumentSaveReason {
  Manual = 1,
  AfterDelay = 2,
  FocusOut = 3,
}

export enum TextDocumentChangeReason {
  Undo = 1,
  Redo = 2,
}

export { TextEditorRevealType } from './editor';

@es5ClassCompat
export class TaskGroup implements vscode.TaskGroup {
  isDefault?: boolean;
  private _id: string;

  public static Clean: TaskGroup = new TaskGroup('clean', 'Clean');

  public static Build: TaskGroup = new TaskGroup('build', 'Build');

  public static Rebuild: TaskGroup = new TaskGroup('rebuild', 'Rebuild');

  public static Test: TaskGroup = new TaskGroup('test', 'Test');

  public static from(value: string) {
    switch (value) {
      case 'clean':
        return TaskGroup.Clean;
      case 'build':
        return TaskGroup.Build;
      case 'rebuild':
        return TaskGroup.Rebuild;
      case 'test':
        return TaskGroup.Test;
      default:
        return undefined;
    }
  }

  constructor(id: string, _label: string) {
    if (typeof id !== 'string') {
      throw illegalArgument('name');
    }
    if (typeof _label !== 'string') {
      throw illegalArgument('name');
    }
    this._id = id;
  }

  get id(): string {
    return this._id;
  }
}

function computeTaskExecutionId(values: string[]): string {
  let id = '';
  // eslint-disable-next-line @typescript-eslint/prefer-for-of
  for (let i = 0; i < values.length; i++) {
    id += values[i].replace(/,/g, ',,') + ',';
  }
  return id;
}

/**
 * Options for a process execution
 */
export interface ProcessExecutionOptions {
  /**
   * The current working directory of the executed program or shell.
   * If omitted the tools current workspace root is used.
   */
  cwd?: string;

  /**
   * The additional environment of the executed program or shell. If omitted
   * the parent process' environment is used. If provided it is merged with
   * the parent process' environment.
   */
  env?: { [key: string]: string };
}

/**
 * The shell quoting options.
 */
export interface ShellQuotingOptions {
  /**
   * The character used to do character escaping. If a string is provided only spaces
   * are escaped. If a `{ escapeChar, charsToEscape }` literal is provide all characters
   * in `charsToEscape` are escaped using the `escapeChar`.
   */
  escape?:
    | string
    | {
        /**
         * The escape character.
         */
        escapeChar: string;
        /**
         * The characters to escape.
         */
        charsToEscape: string;
      };

  /**
   * The character used for strong quoting. The string's length must be 1.
   */
  strong?: string;

  /**
   * The character used for weak quoting. The string's length must be 1.
   */
  weak?: string;
}

/**
 * Options for a shell execution
 */
export interface ShellExecutionOptions {
  /**
   * The shell executable.
   */
  executable?: string;

  /**
   * The arguments to be passed to the shell executable used to run the task. Most shells
   * require special arguments to execute a command. For  example `bash` requires the `-c`
   * argument to execute a command, `PowerShell` requires `-Command` and `cmd` requires both
   * `/d` and `/c`.
   */
  shellArgs?: string[];

  /**
   * The shell quotes supported by this shell.
   */
  shellQuoting?: ShellQuotingOptions;

  /**
   * The current working directory of the executed shell.
   * If omitted the tools current workspace root is used.
   */
  cwd?: string;

  /**
   * The additional environment of the executed shell. If omitted
   * the parent process' environment is used. If provided it is merged with
   * the parent process' environment.
   */
  env?: { [key: string]: string };
}

@es5ClassCompat
export class ProcessExecution implements vscode.ProcessExecution {
  private _process: string;
  private _args: string[];
  private _options: ProcessExecutionOptions | undefined;

  constructor(process: string, options?: ProcessExecutionOptions);
  constructor(process: string, args: string[], options?: ProcessExecutionOptions);
  constructor(process: string, varg1?: string[] | ProcessExecutionOptions, varg2?: ProcessExecutionOptions) {
    if (typeof process !== 'string') {
      throw illegalArgument('process');
    }
    this._process = process;
    if (varg1 !== undefined) {
      if (Array.isArray(varg1)) {
        this._args = varg1;
        this._options = varg2;
      } else {
        this._options = varg1;
      }
    }
    if (this._args === undefined) {
      this._args = [];
    }
  }

  get process(): string {
    return this._process;
  }

  set process(value: string) {
    if (typeof value !== 'string') {
      throw illegalArgument('process');
    }
    this._process = value;
  }

  get args(): string[] {
    return this._args;
  }

  set args(value: string[]) {
    if (!Array.isArray(value)) {
      value = [];
    }
    this._args = value;
  }

  get options(): ProcessExecutionOptions | undefined {
    return this._options;
  }

  set options(value: ProcessExecutionOptions | undefined) {
    this._options = value;
  }

  public computeId(): string {
    const props: string[] = [];
    props.push('process');
    if (this._process !== undefined) {
      props.push(this._process);
    }
    if (this._args && this._args.length > 0) {
      for (const arg of this._args) {
        props.push(arg);
      }
    }
    return computeTaskExecutionId(props);
  }

  public static is(value: ShellExecution | ProcessExecution | CustomExecution): boolean {
    const candidate = value as ProcessExecution;
    return candidate && !!candidate.process;
  }
}

@es5ClassCompat
export class ShellExecution implements vscode.ShellExecution {
  private _commandLine: string;
  private _command: string | vscode.ShellQuotedString;
  private _args: (string | vscode.ShellQuotedString)[];
  private _options: ShellExecutionOptions | undefined;

  constructor(commandLine: string, options?: ShellExecutionOptions);
  constructor(
    command: string | vscode.ShellQuotedString,
    args: (string | vscode.ShellQuotedString)[],
    options?: ShellExecutionOptions,
  );
  constructor(
    arg0: string | vscode.ShellQuotedString,
    arg1?: ShellExecutionOptions | (string | vscode.ShellQuotedString)[],
    arg2?: ShellExecutionOptions,
  ) {
    if (Array.isArray(arg1)) {
      if (!arg0) {
        throw illegalArgument("command can't be undefined or null");
      }
      if (typeof arg0 !== 'string' && typeof arg0.value !== 'string') {
        throw illegalArgument('command');
      }
      this._command = arg0;
      this._args = arg1 as (string | vscode.ShellQuotedString)[];
      this._options = arg2;
    } else {
      if (typeof arg0 !== 'string') {
        throw illegalArgument('commandLine');
      }
      this._commandLine = arg0;
      this._options = arg1;
    }
  }

  get commandLine(): string {
    return this._commandLine;
  }

  set commandLine(value: string) {
    if (typeof value !== 'string') {
      throw illegalArgument('commandLine');
    }
    this._commandLine = value;
  }

  get command(): string | vscode.ShellQuotedString {
    return this._command;
  }

  set command(value: string | vscode.ShellQuotedString) {
    if (typeof value !== 'string' && typeof value.value !== 'string') {
      throw illegalArgument('command');
    }
    this._command = value;
  }

  get args(): (string | vscode.ShellQuotedString)[] {
    return this._args;
  }

  set args(value: (string | vscode.ShellQuotedString)[]) {
    this._args = value || [];
  }

  get options(): ShellExecutionOptions | undefined {
    return this._options;
  }

  set options(value: ShellExecutionOptions | undefined) {
    this._options = value;
  }

  public computeId(): string {
    const props: string[] = [];
    props.push('shell');
    if (this._commandLine !== undefined) {
      props.push(this._commandLine);
    }
    if (this._command !== undefined) {
      props.push(typeof this._command === 'string' ? this._command : this._command.value);
    }
    if (this._args && this._args.length > 0) {
      for (const arg of this._args) {
        props.push(typeof arg === 'string' ? arg : arg.value);
      }
    }
    return computeTaskExecutionId(props);
  }

  public static is(value: ShellExecution | ProcessExecution | CustomExecution): boolean {
    const candidate = value as ShellExecution;
    return candidate && (!!candidate.commandLine || !!candidate.command);
  }
}

export enum ShellQuoting {
  Escape = 1,
  Strong = 2,
  Weak = 3,
}

export enum TaskScope {
  Global = 1,
  Workspace = 2,
}

@es5ClassCompat
export class CustomExecution2 implements vscode.CustomExecution {
  private _callback: () => Promise<vscode.Pseudoterminal>;
  constructor(callback: () => Promise<vscode.Pseudoterminal>) {
    this._callback = callback;
  }
  public computeId(): string {
    return 'customExecution' + uuid();
  }

  public set callback(value: () => Promise<vscode.Pseudoterminal>) {
    this._callback = value;
  }

  public get callback(): () => Promise<vscode.Pseudoterminal> {
    return this._callback;
  }
}

@es5ClassCompat
export class CustomExecution implements vscode.CustomExecution {
  private _callback: (resolvedDefinition?: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal>;
  constructor(callback: (resolvedDefinition?: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal>) {
    this._callback = callback;
  }

  public computeId(): string {
    return 'customExecution' + uuid();
  }

  public set callback(value: (resolvedDefinition?: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal>) {
    this._callback = value;
  }

  public get callback(): (resolvedDefinition?: vscode.TaskDefinition) => Thenable<vscode.Pseudoterminal> {
    return this._callback;
  }
}

/**
 * A structure that defines a task kind in the system.
 * The value must be JSON-stringifyable.
 */
export interface TaskDefinition {
  /**
   * The task definition describing the task provided by an extension.
   * Usually a task provider defines more properties to identify
   * a task. They need to be defined in the package.json of the
   * extension under the 'taskDefinitions' extension point. The npm
   * task definition for example looks like this
   * ```typescript
   * interface NpmTaskDefinition extends TaskDefinition {
   *     script: string;
   * }
   * ```
   *
   * Note that type identifier starting with a '$' are reserved for internal
   * usages and shouldn't be used by extensions.
   */
  readonly type: string;

  /**
   * Additional attributes of a concrete task definition.
   */
  [name: string]: any;
}

@es5ClassCompat
export class Task implements vscode.Task2 {
  private static ExtensionCallbackType = 'customExecution';
  private static ProcessType = 'process';
  private static ShellType = 'shell';
  private static EmptyType = '$empty';

  private __id: string | undefined;

  private _definition: TaskDefinition;
  private _scope: vscode.TaskScope.Global | vscode.TaskScope.Workspace | vscode.WorkspaceFolder | undefined;
  private _name: string;
  private _execution: ProcessExecution | ShellExecution | CustomExecution | undefined;
  private _problemMatchers: string[];
  private _hasDefinedMatchers: boolean;
  private _isBackground: boolean;
  private _source: string;
  private _group: TaskGroup | undefined;
  private _presentationOptions: vscode.TaskPresentationOptions;
  private _runOptions: vscode.RunOptions;
  private _detail: string | undefined;

  constructor(
    definition: TaskDefinition,
    name: string,
    source: string,
    execution?: ProcessExecution | ShellExecution | CustomExecution | vscode.CustomExecution,
    problemMatchers?: string | string[],
  );
  constructor(
    definition: TaskDefinition,
    scope: vscode.TaskScope.Global | vscode.TaskScope.Workspace | vscode.WorkspaceFolder,
    name: string,
    source: string,
    execution?: ProcessExecution | ShellExecution | CustomExecution | vscode.CustomExecution,
    problemMatchers?: string | string[],
  );
  constructor(
    definition: TaskDefinition,
    arg2: string | (vscode.TaskScope.Global | vscode.TaskScope.Workspace) | vscode.WorkspaceFolder,
    arg3: any,
    arg4?: any,
    arg5?: any,
    arg6?: any,
  ) {
    this.definition = definition;
    let problemMatchers: string | string[];
    if (typeof arg2 === 'string') {
      this.name = arg2;
      this.source = arg3;
      this.execution = arg4;
      problemMatchers = arg5;
    } else if (arg2 === TaskScope.Global || arg2 === TaskScope.Workspace) {
      this.target = arg2;
      this.name = arg3;
      this.source = arg4;
      this.execution = arg5;
      problemMatchers = arg6;
    } else {
      this.target = arg2;
      this.name = arg3;
      this.source = arg4;
      this.execution = arg5;
      problemMatchers = arg6;
    }
    if (typeof problemMatchers === 'string') {
      this._problemMatchers = [problemMatchers];
      this._hasDefinedMatchers = true;
    } else if (Array.isArray(problemMatchers)) {
      this._problemMatchers = problemMatchers;
      this._hasDefinedMatchers = true;
    } else {
      this._problemMatchers = [];
      this._hasDefinedMatchers = false;
    }
    this._isBackground = false;
    this._presentationOptions = Object.create(null);
    this._runOptions = Object.create(null);
  }

  get _id(): string | undefined {
    return this.__id;
  }

  set _id(value: string | undefined) {
    this.__id = value;
  }

  private clear(): void {
    if (this.__id === undefined) {
      return;
    }
    this.__id = undefined;
    this._scope = undefined;
    this.computeDefinitionBasedOnExecution();
  }

  private computeDefinitionBasedOnExecution(): void {
    if (this._execution instanceof ProcessExecution) {
      this._definition = {
        type: Task.ProcessType,
        id: this._execution.computeId(),
      };
    } else if (this._execution instanceof ShellExecution) {
      this._definition = {
        type: Task.ShellType,
        id: this._execution.computeId(),
      };
    } else if (this._execution instanceof CustomExecution) {
      this._definition = {
        type: Task.ExtensionCallbackType,
        id: this._execution.computeId(),
      };
    } else {
      this._definition = {
        type: Task.EmptyType,
        id: uuid(),
      };
    }
  }

  get definition(): TaskDefinition {
    return this._definition;
  }

  set definition(value: TaskDefinition) {
    if (value === undefined || value === null) {
      throw illegalArgument("Kind can't be undefined or null");
    }
    this.clear();
    this._definition = value;
  }

  get scope(): vscode.TaskScope.Global | vscode.TaskScope.Workspace | vscode.WorkspaceFolder | undefined {
    return this._scope;
  }

  set target(value: vscode.TaskScope.Global | vscode.TaskScope.Workspace | vscode.WorkspaceFolder) {
    this.clear();
    this._scope = value;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    if (typeof value !== 'string') {
      throw illegalArgument('name');
    }
    this.clear();
    this._name = value;
  }

  get execution(): ProcessExecution | ShellExecution | CustomExecution | undefined {
    return this._execution;
  }

  set execution(value: ProcessExecution | ShellExecution | CustomExecution | undefined) {
    this.execution2 = value;
  }

  get execution2(): ProcessExecution | ShellExecution | CustomExecution | undefined {
    return this._execution;
  }

  set execution2(value: ProcessExecution | ShellExecution | CustomExecution | undefined) {
    if (value === null) {
      value = undefined;
    }
    this.clear();
    this._execution = value;
    const type = this._definition.type;
    if (
      Task.EmptyType === type ||
      Task.ProcessType === type ||
      Task.ShellType === type ||
      Task.ExtensionCallbackType === type
    ) {
      this.computeDefinitionBasedOnExecution();
    }
  }

  get problemMatchers(): string[] {
    return this._problemMatchers;
  }

  set problemMatchers(value: string[]) {
    if (!Array.isArray(value)) {
      this.clear();
      this._problemMatchers = [];
      this._hasDefinedMatchers = false;
      return;
    } else {
      this.clear();
      this._problemMatchers = value;
      this._hasDefinedMatchers = true;
    }
  }

  get hasDefinedMatchers(): boolean {
    return this._hasDefinedMatchers;
  }

  get isBackground(): boolean {
    return this._isBackground;
  }

  set isBackground(value: boolean) {
    if (value !== true && value !== false) {
      value = false;
    }
    this.clear();
    this._isBackground = value;
  }

  get source(): string {
    return this._source;
  }

  set source(value: string) {
    if (typeof value !== 'string' || value.length === 0) {
      throw illegalArgument('source must be a string of length > 0');
    }
    this.clear();
    this._source = value;
  }

  get group(): TaskGroup | undefined {
    return this._group;
  }

  set group(value: TaskGroup | undefined) {
    if (value === null) {
      value = undefined;
    }
    this.clear();
    this._group = value;
  }

  get detail(): string | undefined {
    return this._detail;
  }

  set detail(value: string | undefined) {
    if (value === null) {
      value = undefined;
    }
    this._detail = value;
  }

  get presentationOptions(): vscode.TaskPresentationOptions {
    return this._presentationOptions;
  }

  set presentationOptions(value: vscode.TaskPresentationOptions) {
    if (value === null || value === undefined) {
      value = Object.create(null);
    }
    this.clear();
    this._presentationOptions = value;
  }

  get runOptions(): vscode.RunOptions {
    return this._runOptions;
  }

  set runOptions(value: vscode.RunOptions) {
    if (value === null || value === undefined) {
      value = Object.create(null);
    }
    this.clear();
    this._runOptions = value;
  }
}

export enum ExtensionKind {
  /**
   * Extension runs where the UI runs.
   */
  UI = 1,

  /**
   * Extension runs where the remote extension host runs.
   */
  Workspace = 2,
}

export enum TaskPanelKind {
  /**
   * Shares a panel with other tasks. This is the default.
   */
  Shared = 1,

  /**
   * Uses a dedicated panel for this tasks. The panel is not
   * shared with other tasks.
   */
  Dedicated = 2,

  /**
   * Creates a new panel whenever this task is executed.
   */
  New = 3,
}

@es5ClassCompat
export class TerminalLink implements vscode.TerminalLink {
  constructor(public startIndex: number, public length: number, public tooltip?: string) {
    if (typeof startIndex !== 'number' || startIndex < 0) {
      throw illegalArgument('startIndex');
    }
    if (typeof length !== 'number' || length < 1) {
      throw illegalArgument('length');
    }
    if (tooltip !== undefined && typeof tooltip !== 'string') {
      throw illegalArgument('tooltip');
    }
  }
}

@es5ClassCompat
export class TerminalProfile implements vscode.TerminalProfile {
  constructor(public options: vscode.TerminalOptions | vscode.ExtensionTerminalOptions) {
    if (typeof options !== 'object') {
      throw illegalArgument('options');
    }
  }
}

/**
 * Controls the behaviour of the terminal's visibility.
 */
export enum TaskRevealKind {
  /**
   * Always brings the terminal to front if the task is executed.
   */
  Always = 1,

  /**
   * Only brings the terminal to front if a problem is detected executing the task
   * (e.g. the task couldn't be started because).
   */
  Silent = 2,

  /**
   * The terminal never comes to front when the task is executed.
   */
  Never = 3,
}

export enum UIKind {
  Desktop = 1,
  Web = 2,
}

/**
 * 评论模式
 */
export enum CommentMode {
  /**
   * 编辑状态
   */
  Editing = 0,
  /**
   * 预览状态
   */
  Preview = 1,
}

/**
 * thread 展开模式
 */
export enum CommentThreadCollapsibleState {
  /**
   * 收起状态
   */
  Collapsed = 0,
  /**
   * 展开状态
   */
  Expanded = 1,
}

// #region Theming

@es5ClassCompat
export class ColorTheme implements vscode.ColorTheme {
  constructor(public readonly kind: ColorThemeKind) {}
}

export enum ColorThemeKind {
  Light = 1,
  Dark = 2,
  HighContrast = 3,
}

export enum SymbolTag {
  Deprecated = 1,
}

export enum ExtensionMode {
  /**
   * The extension is installed normally (for example, from the marketplace
   * or VSIX) in VS Code.
   */
  Production = 1,

  /**
   * The extension is running from an `--extensionDevelopmentPath` provided
   * when launching VS Code.
   */
  Development = 2,

  /**
   * The extension is running from an `--extensionDevelopmentPath` and
   * the extension host is running unit tests.
   */
  // TODO: 暂未实现该模式
  Test = 3,
}

// #endregion Theming

@es5ClassCompat
export class CallHierarchyItem {
  _sessionId?: string;
  _itemId?: string;

  kind: SymbolKind;
  name: string;
  detail?: string;
  uri: Uri;
  range: Range;
  selectionRange: Range;

  constructor(kind: SymbolKind, name: string, detail: string, uri: Uri, range: Range, selectionRange: Range) {
    this.kind = kind;
    this.name = name;
    this.detail = detail;
    this.uri = uri;
    this.range = range;
    this.selectionRange = selectionRange;
  }
}

export class CallHierarchyIncomingCall {
  from: vscode.CallHierarchyItem;
  fromRanges: vscode.Range[];

  constructor(item: vscode.CallHierarchyItem, fromRanges: vscode.Range[]) {
    this.fromRanges = fromRanges;
    this.from = item;
  }
}
export class CallHierarchyOutgoingCall {
  to: vscode.CallHierarchyItem;
  fromRanges: vscode.Range[];

  constructor(item: vscode.CallHierarchyItem, fromRanges: vscode.Range[]) {
    this.fromRanges = fromRanges;
    this.to = item;
  }
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
}
// #region Semantic Coloring

@es5ClassCompat
export class SemanticTokensLegend {
  public readonly tokenTypes: string[];
  public readonly tokenModifiers: string[];

  constructor(tokenTypes: string[], tokenModifiers: string[] = []) {
    this.tokenTypes = tokenTypes;
    this.tokenModifiers = tokenModifiers;
  }
}

function isStrArrayOrUndefined(arg: any): arg is string[] | undefined {
  return typeof arg === 'undefined' || isStringArray(arg);
}

export class SemanticTokensBuilder {
  private _prevLine: number;
  private _prevChar: number;
  private _dataIsSortedAndDeltaEncoded: boolean;
  private _data: number[];
  private _dataLen: number;
  private _tokenTypeStrToInt: Map<string, number>;
  private _tokenModifierStrToInt: Map<string, number>;
  private _hasLegend: boolean;

  constructor(legend?: vscode.SemanticTokensLegend) {
    this._prevLine = 0;
    this._prevChar = 0;
    this._dataIsSortedAndDeltaEncoded = true;
    this._data = [];
    this._dataLen = 0;
    this._tokenTypeStrToInt = new Map<string, number>();
    this._tokenModifierStrToInt = new Map<string, number>();
    this._hasLegend = false;
    if (legend) {
      this._hasLegend = true;
      for (let i = 0, len = legend.tokenTypes.length; i < len; i++) {
        this._tokenTypeStrToInt.set(legend.tokenTypes[i], i);
      }
      for (let i = 0, len = legend.tokenModifiers.length; i < len; i++) {
        this._tokenModifierStrToInt.set(legend.tokenModifiers[i], i);
      }
    }
  }

  public push(line: number, char: number, length: number, tokenType: number, tokenModifiers?: number): void;
  public push(range: Range, tokenType: string, tokenModifiers?: string[]): void;
  public push(arg0: any, arg1: any, arg2: any, arg3?: any, arg4?: any): void {
    if (
      typeof arg0 === 'number' &&
      typeof arg1 === 'number' &&
      typeof arg2 === 'number' &&
      typeof arg3 === 'number' &&
      (typeof arg4 === 'number' || typeof arg4 === 'undefined')
    ) {
      if (typeof arg4 === 'undefined') {
        arg4 = 0;
      }
      // 1st overload
      return this._pushEncoded(arg0, arg1, arg2, arg3, arg4);
    }
    if (Range.isRange(arg0) && typeof arg1 === 'string' && isStrArrayOrUndefined(arg2)) {
      // 2nd overload
      return this._push(arg0, arg1, arg2);
    }
    throw illegalArgument();
  }

  private _push(range: vscode.Range, tokenType: string, tokenModifiers?: string[]): void {
    if (!this._hasLegend) {
      throw new Error('Legend must be provided in constructor');
    }
    if (range.start.line !== range.end.line) {
      throw new Error('`range` cannot span multiple lines');
    }
    if (!this._tokenTypeStrToInt.has(tokenType)) {
      throw new Error('`tokenType` is not in the provided legend');
    }
    const line = range.start.line;
    const char = range.start.character;
    const length = range.end.character - range.start.character;
    const nTokenType = this._tokenTypeStrToInt.get(tokenType)!;
    let nTokenModifiers = 0;
    if (tokenModifiers) {
      for (const tokenModifier of tokenModifiers) {
        if (!this._tokenModifierStrToInt.has(tokenModifier)) {
          throw new Error('`tokenModifier` is not in the provided legend');
        }
        const nTokenModifier = this._tokenModifierStrToInt.get(tokenModifier)!;
        nTokenModifiers |= (1 << nTokenModifier) >>> 0;
      }
    }
    this._pushEncoded(line, char, length, nTokenType, nTokenModifiers);
  }

  private _pushEncoded(line: number, char: number, length: number, tokenType: number, tokenModifiers: number): void {
    if (
      this._dataIsSortedAndDeltaEncoded &&
      (line < this._prevLine || (line === this._prevLine && char < this._prevChar))
    ) {
      // push calls were ordered and are no longer ordered
      this._dataIsSortedAndDeltaEncoded = false;

      // Remove delta encoding from data
      const tokenCount = (this._data.length / 5) | 0;
      let prevLine = 0;
      let prevChar = 0;
      for (let i = 0; i < tokenCount; i++) {
        let line = this._data[5 * i];
        let char = this._data[5 * i + 1];

        if (line === 0) {
          // on the same line as previous token
          line = prevLine;
          char += prevChar;
        } else {
          // on a different line than previous token
          line += prevLine;
        }

        this._data[5 * i] = line;
        this._data[5 * i + 1] = char;

        prevLine = line;
        prevChar = char;
      }
    }

    let pushLine = line;
    let pushChar = char;
    if (this._dataIsSortedAndDeltaEncoded && this._dataLen > 0) {
      pushLine -= this._prevLine;
      if (pushLine === 0) {
        pushChar -= this._prevChar;
      }
    }

    this._data[this._dataLen++] = pushLine;
    this._data[this._dataLen++] = pushChar;
    this._data[this._dataLen++] = length;
    this._data[this._dataLen++] = tokenType;
    this._data[this._dataLen++] = tokenModifiers;

    this._prevLine = line;
    this._prevChar = char;
  }

  private static _sortAndDeltaEncode(data: number[]): Uint32Array {
    const pos: number[] = [];
    const tokenCount = (data.length / 5) | 0;
    for (let i = 0; i < tokenCount; i++) {
      pos[i] = i;
    }
    pos.sort((a, b) => {
      const aLine = data[5 * a];
      const bLine = data[5 * b];
      if (aLine === bLine) {
        const aChar = data[5 * a + 1];
        const bChar = data[5 * b + 1];
        return aChar - bChar;
      }
      return aLine - bLine;
    });
    const result = new Uint32Array(data.length);
    let prevLine = 0;
    let prevChar = 0;
    for (let i = 0; i < tokenCount; i++) {
      const srcOffset = 5 * pos[i];
      const line = data[srcOffset + 0];
      const char = data[srcOffset + 1];
      const length = data[srcOffset + 2];
      const tokenType = data[srcOffset + 3];
      const tokenModifiers = data[srcOffset + 4];

      const pushLine = line - prevLine;
      const pushChar = pushLine === 0 ? char - prevChar : char;

      const dstOffset = 5 * i;
      result[dstOffset + 0] = pushLine;
      result[dstOffset + 1] = pushChar;
      result[dstOffset + 2] = length;
      result[dstOffset + 3] = tokenType;
      result[dstOffset + 4] = tokenModifiers;

      prevLine = line;
      prevChar = char;
    }

    return result;
  }

  public build(resultId?: string): SemanticTokens {
    if (!this._dataIsSortedAndDeltaEncoded) {
      return new SemanticTokens(SemanticTokensBuilder._sortAndDeltaEncode(this._data), resultId);
    }
    return new SemanticTokens(new Uint32Array(this._data), resultId);
  }
}

export class SemanticTokens {
  readonly resultId?: string;
  readonly data: Uint32Array;

  constructor(data: Uint32Array, resultId?: string) {
    this.resultId = resultId;
    this.data = data;
  }
}

export class SemanticTokensEdit {
  readonly start: number;
  readonly deleteCount: number;
  readonly data?: Uint32Array;

  constructor(start: number, deleteCount: number, data?: Uint32Array) {
    this.start = start;
    this.deleteCount = deleteCount;
    this.data = data;
  }
}

export class SemanticTokensEdits {
  readonly resultId?: string;
  readonly edits: SemanticTokensEdit[];

  constructor(edits: SemanticTokensEdit[], resultId?: string) {
    this.resultId = resultId;
    this.edits = edits;
  }
}

// #endregion Semantic Coloring

// #region EvaluatableExpression

@es5ClassCompat
export class EvaluatableExpression implements vscode.EvaluatableExpression {
  readonly range: vscode.Range;
  readonly expression?: string;

  // FIXME: 这里写 vscode.Range 跑测试会报 ReferenceError: vscode is not defined
  constructor(range: any, expression?: string) {
    this.range = range;
    this.expression = expression;
  }
}
// #endregion EvaluatableExpression

// #region Timeline

@es5ClassCompat
export class TimelineItem implements vscode.TimelineItem {
  constructor(public label: string, public timestamp: number) {}
}

const canceledName = 'Canceled';

export class CancellationError extends Error {
  constructor() {
    super(canceledName);
    this.name = this.message;
  }
}

// #endregion Timeline

// #region Inline Values

@es5ClassCompat
@es5ClassCompat
export class InlineValueText implements vscode.InlineValueText {
  readonly range: Range;
  readonly text: string;

  constructor(range: Range, text: string) {
    this.range = range;
    this.text = text;
  }
}

@es5ClassCompat
export class InlineValueVariableLookup implements vscode.InlineValueVariableLookup {
  readonly range: Range;
  readonly variableName?: string;
  readonly caseSensitiveLookup: boolean;

  constructor(range: Range, variableName?: string, caseSensitiveLookup = true) {
    this.range = range;
    this.variableName = variableName;
    this.caseSensitiveLookup = caseSensitiveLookup;
  }
}

@es5ClassCompat
export class InlineValueEvaluatableExpression implements vscode.InlineValueEvaluatableExpression {
  readonly range: Range;
  readonly expression?: string;

  constructor(range: Range, expression?: string) {
    this.range = range;
    this.expression = expression;
  }
}

@es5ClassCompat
export class InlineValueContext implements vscode.InlineValueContext {
  readonly frameId: number;
  readonly stoppedLocation: vscode.Range;

  constructor(frameId: number, range: Range) {
    this.frameId = frameId;
    this.stoppedLocation = range;
  }
}
// #endregion Inline Values

// #region InlayHint

export enum InlayHintKind {
  Other = 0,
  Type = 1,
  Parameter = 2,
}

@es5ClassCompat
export class InlayHint {
  text: string;
  position: Position;
  kind?: vscode.InlayHintKind;
  whitespaceBefore?: boolean;
  whitespaceAfter?: boolean;

  constructor(text: string, position: Position, kind?: vscode.InlayHintKind) {
    this.text = text;
    this.position = position;
    this.kind = kind;
  }
}

// #endregion InlayHint

// #region Test Adapter
export enum TestResultState {
  Queued = 1,
  Running = 2,
  Passed = 3,
  Failed = 4,
  Skipped = 5,
  Errored = 6,
}

export enum TestRunProfileKind {
  Run = 1,
  Debug = 2,
  Coverage = 3,
}

@es5ClassCompat
export class TestRunRequest implements vscode.TestRunRequest {
  constructor(
    public readonly include: vscode.TestItem[] | undefined,
    public readonly exclude: vscode.TestItem[] | undefined,
    public readonly profile: vscode.TestRunProfile | undefined,
  ) {}
}

@es5ClassCompat
export class TestMessage implements vscode.TestMessage {
  public expectedOutput?: string;
  public actualOutput?: string;
  public location?: vscode.Location;

  public static diff(message: string | vscode.MarkdownString, expected: string, actual: string) {
    const msg = new TestMessage(message);
    msg.expectedOutput = expected;
    msg.actualOutput = actual;
    return msg;
  }

  constructor(public message: string | vscode.MarkdownString) {}
}

@es5ClassCompat
export class TestTag implements vscode.TestTag {
  constructor(public readonly id: string) {}
}
// #endregion
