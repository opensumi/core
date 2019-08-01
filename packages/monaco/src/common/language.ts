import { IDisposable } from '@ali/ide-core-common';
import * as LSTypes from 'vscode-languageserver-types';

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
/**
* The diagnostic's severity.
*/
export declare namespace DiagnosticSeverity {
  /**
   * Reports an error.
   */
  const Error: 1;
  /**
   * Reports a warning.
   */
  const Warning: 2;
  /**
   * Reports an information.
   */
  const Information: 3;
  /**
   * Reports a hint.
   */
  const Hint: 4;
}
export declare type DiagnosticSeverity = 1 | 2 | 3 | 4;
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
}
export function asSeverity(severity?: number): monaco.MarkerSeverity {
  if (severity === 1) {
      return monaco.MarkerSeverity.Error;
  }
  if (severity === 2) {
      return monaco.MarkerSeverity.Warning;
  }
  if (severity === 3) {
      return monaco.MarkerSeverity.Info;
  }
  return monaco.MarkerSeverity.Hint;
}
export function asRelatedInformations(relatedInformation?: DiagnosticRelatedInformation[]): monaco.editor.IRelatedInformation[] | undefined {
  if (!relatedInformation) {
      return undefined;
  }
  return relatedInformation.map((item) => asRelatedInformation(item));
}

export function asRelatedInformation(relatedInformation: DiagnosticRelatedInformation): monaco.editor.IRelatedInformation {
  return {
      resource: monaco.Uri.parse(relatedInformation.location.uri),
      startLineNumber: relatedInformation.location.range.start.line + 1,
      startColumn: relatedInformation.location.range.start.character + 1,
      endLineNumber: relatedInformation.location.range.end.line + 1,
      endColumn: relatedInformation.location.range.end.character + 1,
      message: relatedInformation.message,
  };
}
export function asDiagnostics(diagnostics: Diagnostic[] | undefined): monaco.editor.IMarkerData[] | undefined {
  if (!diagnostics) {
    return undefined;
  }
  return diagnostics.map((diagnostic) => asDiagnostic(diagnostic));
}

export function asDiagnostic(diagnostic: Diagnostic): monaco.editor.IMarkerData {
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
  };
}

export interface WorkspaceSymbolParams {
  query: string;
}

export interface WorkspaceSymbolProvider {
  provideWorkspaceSymbols(params: WorkspaceSymbolParams, token: monaco.CancellationToken): Thenable<LSTypes.SymbolInformation[]>;
  resolveWorkspaceSymbol(symbol: LSTypes.SymbolInformation, token: monaco.CancellationToken): Thenable<LSTypes.SymbolInformation>;
}
