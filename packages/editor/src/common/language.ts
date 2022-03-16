import LSTypes from 'vscode-languageserver-types';

import { CancellationToken, Command, IAccessibilityInformation, Severity } from '@opensumi/ide-core-common';
import { IDisposable, MarkerSeverity } from '@opensumi/ide-core-common';
import { IRelativePattern } from '@opensumi/ide-core-common/lib/utils/glob';
import { URI as Uri } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import { editor } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import type { IRelatedInformation } from '@opensumi/monaco-editor-core/esm/vs/platform/markers/common/markers';

export const ILanguageService = Symbol('ILanguageService');

export interface ILanguageService {
  languages: Language[];
  workspaceSymbolProviders: WorkspaceSymbolProvider[];
  getLanguage(languageId: string): Language | undefined;
  registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): IDisposable;
}

export interface DiagnosticCollection extends IDisposable {
  set(uri: string, diagnostics: Diagnostic[]): void;
}
/**
 * Represents a related message and source code location for a diagnostic. This should be
 * used to point to code locations that cause or related to a diagnostics, e.g when duplicating
 * a symbol in a scope.
 */
export interface DiagnosticRelatedInformation {
  /**
   * The location of this related diagnostic information.
   */
  location: LSTypes.Location;
  /**
   * The message of this related diagnostic information.
   */
  message: string;
}
/**
 * The DiagnosticRelatedInformation namespace provides helper functions to work with
 * [DiagnosticRelatedInformation](#DiagnosticRelatedInformation) literals.
 */
export declare namespace DiagnosticRelatedInformation {
  /**
   * Creates a new DiagnosticRelatedInformation literal.
   */
  function create(location: Location, message: string): DiagnosticRelatedInformation;
  /**
   * Checks whether the given literal conforms to the [DiagnosticRelatedInformation](#DiagnosticRelatedInformation) interface.
   */
  function is(value: any): value is DiagnosticRelatedInformation;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/**
 * Represents a diagnostic, such as a compiler error or warning. Diagnostic objects
 * are only valid in the scope of a resource.
 */
export interface Diagnostic {
  /**
   * The range at which the message applies
   * TODO 类型声明
   */
  range: LSTypes.Range;
  /**
   * The diagnostic's severity. Can be omitted. If omitted it is up to the
   * client to interpret diagnostics as error, warning, info or hint.
   */
  severity?: DiagnosticSeverity;
  /**
   * The diagnostic's code, which might appear in the user interface.
   */
  code?: number | string;
  /**
   * A human-readable string describing the source of this
   * diagnostic, e.g. 'typescript' or 'super lint'.
   */
  source?: string;
  /**
   * The diagnostic's message.
   */
  message: string;
  /**
   * An array of related diagnostic information, e.g. when symbol-names within
   * a scope collide all definitions can be marked via this property.
   */
  relatedInformation?: DiagnosticRelatedInformation[];

  tags?: DiagnosticTag[];
}

export enum DiagnosticTag {
  Unnecessary = 1,
  Deprecated = 2,
}

export function asSeverity(severity?: number): MarkerSeverity {
  if (severity === 1) {
    return MarkerSeverity.Error;
  }
  if (severity === 2) {
    return MarkerSeverity.Warning;
  }
  if (severity === 3) {
    return MarkerSeverity.Info;
  }
  return MarkerSeverity.Hint;
}
export function asRelatedInformations(
  relatedInformation?: DiagnosticRelatedInformation[],
): IRelatedInformation[] | undefined {
  if (!relatedInformation) {
    return undefined;
  }
  return relatedInformation.map((item) => asRelatedInformation(item));
}

export function asRelatedInformation(relatedInformation: DiagnosticRelatedInformation): IRelatedInformation {
  return {
    resource: Uri.parse(relatedInformation.location.uri),
    startLineNumber: relatedInformation.location.range.start.line + 1,
    startColumn: relatedInformation.location.range.start.character + 1,
    endLineNumber: relatedInformation.location.range.end.line + 1,
    endColumn: relatedInformation.location.range.end.character + 1,
    message: relatedInformation.message,
  };
}
export function asDiagnostics(diagnostics: Diagnostic[] | undefined): editor.IMarkerData[] | undefined {
  if (!diagnostics) {
    return undefined;
  }
  return diagnostics.map((diagnostic) => asDiagnostic(diagnostic));
}

export function asDiagnostic(diagnostic: Diagnostic): editor.IMarkerData {
  return {
    code: typeof diagnostic.code === 'number' ? diagnostic.code.toString() : diagnostic.code,
    severity: asSeverity(diagnostic.severity),
    message: diagnostic.message,
    source: diagnostic.source,
    startLineNumber: diagnostic.range.start.line + 1,
    startColumn: diagnostic.range.start.character + 1,
    endLineNumber: diagnostic.range.end.line + 1,
    endColumn: diagnostic.range.end.character + 1,
    relatedInformation: asRelatedInformations(diagnostic.relatedInformation),
    tags: diagnostic.tags as number[],
  };
}

export interface WorkspaceSymbolParams {
  query: string;
}

export interface WorkspaceSymbolProvider {
  provideWorkspaceSymbols(
    params: WorkspaceSymbolParams,
    token: CancellationToken,
  ): Thenable<LSTypes.SymbolInformation[]>;
  resolveWorkspaceSymbol(
    symbol: LSTypes.SymbolInformation,
    token: CancellationToken,
  ): Thenable<LSTypes.SymbolInformation>;
}

export interface Language {
  readonly id: string;
  readonly name: string;
  readonly extensions: Set<string>;
  readonly filenames: Set<string>;
}

export interface LanguageFilter {
  language?: string;
  scheme?: string;
  pattern?: string | IRelativePattern;
  hasAccessToAllModels?: boolean;
}

export type LanguageSelector = string | LanguageFilter | (string | LanguageFilter)[];
