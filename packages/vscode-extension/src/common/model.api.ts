// 内置的api类型声明
import * as vscode from 'vscode';
import URI from 'vscode-uri';

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
