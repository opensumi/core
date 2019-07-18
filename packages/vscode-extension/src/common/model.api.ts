// 内置的api类型声明
import * as vscode from 'vscode';
import URI, { UriComponents } from 'vscode-uri';

/**
 * A position in the editor. This interface is suitable for serialization.
 */
export interface Position {
  /**
   * line number (starts at 1)
   */
  readonly lineNumber: number;
  /**
   * column (the first character in a line is between column 1 and column 2)
   */
  readonly column: number;
}

export interface Range {
  /**
   * Line number on which the range starts (starts at 1).
   */
  readonly startLineNumber: number;
  /**
   * Column on which the range starts in line `startLineNumber` (starts at 1).
   */
  readonly startColumn: number;
  /**
   * Line number on which the range ends.
   */
  readonly endLineNumber: number;
  /**
   * Column on which the range ends in line `endLineNumber`.
   */
  readonly endColumn: number;
}

export interface MarkdownString {
  value: string;
  isTrusted?: boolean;
}

export interface Hover {
  contents: MarkdownString[];
  range?: Range;
}

export interface SerializedDocumentFilter {
  $serialized: true;
  language?: string;
  scheme?: string;
  pattern?: vscode.GlobPattern;
}

export interface RelativePattern {
  base: string;
  pattern: string;
  pathToRelative(from: string, to: string): string;
}

export interface LanguageFilter {
  language?: string;
  scheme?: string;
  pattern?: string | RelativePattern;
  hasAccessToAllModels?: boolean;
}

export type LanguageSelector = string | LanguageFilter | (string | LanguageFilter)[];

/**
 * Represents a location inside a resource, such as a line
 * inside a text file.
 */
export interface Location {
  /**
   * The resource identifier of this location.
   */
  uri: URI;
  /**
   * The document range of this locations.
   */
  range: Range;
}

export enum CompletionTriggerKind {
  Invoke = 0,
  TriggerCharacter = 1,
  TriggerForIncompleteCompletions = 2,
}

export interface CompletionContext {
  triggerKind: CompletionTriggerKind;
  triggerCharacter?: string;
}

export interface Completion {
  label: string;
  insertText: string;
  type: CompletionType;
  detail?: string;
  documentation?: string | MarkdownString;
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
  noAutoAccept?: boolean;
  commitCharacters?: string[];
  overwriteBefore?: number;
  overwriteAfter?: number;
  additionalTextEdits?: SingleEditOperation[];
  command?: Command;
  snippetType?: SnippetType;
}

export type CompletionType = 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'struct'
  | 'interface'
  | 'module'
  | 'property'
  | 'event'
  | 'operator'
  | 'unit'
  | 'value'
  | 'constant'
  | 'enum'
  | 'enum-member'
  | 'keyword'
  | 'snippet'
  | 'text'
  | 'color'
  | 'file'
  | 'reference'
  | 'customcolor'
  | 'folder'
  | 'type-parameter';

export interface SingleEditOperation {
  range: Range;
  text: string;
  /**
   * This indicates that this operation has "insert" semantics.
   * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
   */
  forceMoveMarkers?: boolean;
}

export type SnippetType = 'internal' | 'textmate';

export interface Command {
  id: string;
  title: string;
  tooltip?: string;
  // tslint:disable-next-line:no-any
  arguments?: any[];
}

export class IdObject {
  id?: number;
}

export interface CompletionDto extends Completion {
  id: number;
  parentId: number;
}

export interface CompletionResultDto extends IdObject {
  completions: CompletionDto[];
  incomplete?: boolean;
}

export type Definition = Location | Location[];

export interface DefinitionLink {
  uri: UriComponents;
  range: Range;
  origin?: Range;
  selectionRange?: Range;
}

// tslint:disable-next-line
export interface FoldingContext {
}

export interface FoldingRange {

  /**
   * The one-based start line of the range to fold. The folded area starts after the line's last character.
   */
  start: number;

  /**
   * The one-based end line of the range to fold. The folded area ends with the line's last character.
   */
  end: number;

  /**
   * Describes the [Kind](#FoldingRangeKind) of the folding range such as [Comment](#FoldingRangeKind.Comment) or
   * [Region](#FoldingRangeKind.Region). The kind is used to categorize folding ranges and used by commands
   * like 'Fold all comments'. See
   * [FoldingRangeKind](#FoldingRangeKind) for an enumeration of standardized kinds.
   */
  kind?: FoldingRangeKind;
}
export class FoldingRangeKind {
  /**
   * Kind for folding range representing a comment. The value of the kind is 'comment'.
   */
  static readonly Comment = new FoldingRangeKind('comment');
  /**
   * Kind for folding range representing a import. The value of the kind is 'imports'.
   */
  static readonly Imports = new FoldingRangeKind('imports');
  /**
   * Kind for folding range representing regions (for example marked by `#region`, `#endregion`).
   * The value of the kind is 'region'.
   */
  static readonly Region = new FoldingRangeKind('region');

  /**
   * Creates a new [FoldingRangeKind](#FoldingRangeKind).
   *
   * @param value of the kind.
   */
  public constructor(public value: string) {
  }
}

export interface SelectionRange {
  range: Range;
}

export interface Color {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

export interface ColorPresentation {
  label: string;
  textEdit?: TextEdit;
  additionalTextEdits?: TextEdit[];
}

export interface ColorInformation {
  range: Range;
  color: Color;
}

export interface TextEdit {
  range: Range;
  text: string;
  eol?: monaco.editor.EndOfLineSequence;
}

// TODO 放在正确位置 start

export interface RawColorInfo {
  color: [number, number, number, number];
  range: Range;
}

// 放在正确位置 end

export enum DocumentHighlightKind {
  Text = 0,
  Read = 1,
  Write = 2,
}

export interface DocumentHighlight {
  range: Range;
  kind?: DocumentHighlightKind;
}
