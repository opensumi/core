// 内置的api类型声明
import * as vscode from 'vscode';

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
