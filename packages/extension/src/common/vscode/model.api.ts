import type vscode from 'vscode';
import { SymbolInformation } from 'vscode-languageserver-types';

import {
  Uri as URI,
  IRange,
  IDisposable,
  UriComponents,
  SymbolTag,
  CancellationToken,
  Event,
  IMarkdownString,
} from '@opensumi/ide-core-common';
import { ISingleEditOperation } from '@opensumi/ide-editor';
// eslint-disable-next-line import/no-restricted-paths
import type { CallHierarchyItem } from '@opensumi/ide-monaco/lib/browser/contrib/callHierarchy';
import type { CompletionItemLabel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';
import type { languages, editor } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

// 内置的api类型声明

import { IndentAction, SymbolKind } from './ext-types';
export { IMarkdownString, SymbolTag, CallHierarchyItem };

export interface IRawColorInfo {
  color: [number, number, number, number];
  range: Range;
}

/**
 * String representations for a color
 */
export interface IColorPresentation {
  /**
   * The label of this color presentation. It will be shown on the color
   * picker header. By default this is also the text that is inserted when selecting
   * this color presentation.
   */
  label: string;
  /**
   * An [edit](#TextEdit) which is applied to a document when selecting
   * this presentation for the color.
   */
  textEdit?: TextEdit;
  /**
   * An optional array of additional [text edits](#TextEdit) that are applied when
   * selecting this color presentation.
   */
  additionalTextEdits?: TextEdit[];
}

export interface CustomCodeAction {
  title: string;
  kind?: string;
  _isSynthetic?: boolean;
  command?: VSCommand;
  edit?: IWorkspaceEditDto;
  isPreferred?: boolean;
}

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

export interface Selection {
  /**
   * The line number on which the selection has started.
   */
  readonly selectionStartLineNumber: number;
  /**
   * The column on `selectionStartLineNumber` where the selection has started.
   */
  readonly selectionStartColumn: number;
  /**
   * The line number on which the selection has ended.
   */
  readonly positionLineNumber: number;
  /**
   * The column on `positionLineNumber` where the selection has ended.
   */
  readonly positionColumn: number;
}
export interface Hover {
  contents: IMarkdownString[];
  range?: Range;
}

export interface SerializedDocumentFilter {
  $serialized: true;
  language?: string;
  scheme?: string;
  pattern?: vscode.GlobPattern;
}

export interface CommentRule {
  lineComment?: string;
  blockComment?: CharacterPair;
}

export interface SerializedRegExp {
  pattern: string;
  flags?: string;
}

export interface SerializedIndentationRule {
  decreaseIndentPattern?: SerializedRegExp;
  increaseIndentPattern?: SerializedRegExp;
  indentNextLinePattern?: SerializedRegExp;
  unIndentedLinePattern?: SerializedRegExp;
}

export interface EnterAction {
  indentAction: IndentAction;
  outdentCurrentLine?: boolean;
  appendText?: string;
  removeText?: number;
}

export interface SerializedOnEnterRule {
  beforeText: SerializedRegExp;
  afterText?: SerializedRegExp;
  action: EnterAction;
  previousLineText: SerializedRegExp;
}

export type CharacterPair = [string, string];

export interface SerializedLanguageConfiguration {
  comments?: CommentRule;
  brackets?: CharacterPair[];
  wordPattern?: SerializedRegExp;
  indentationRules?: SerializedIndentationRule;
  onEnterRules?: SerializedOnEnterRule[];
}

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

export interface LocationLink {
  /**
   * A range to select where this link originates from.
   */
  originSelectionRange?: Range;

  /**
   * The target uri this link points to.
   */
  uri: URI;

  /**
   * The full range this link points to.
   */
  range: Range;

  /**
   * A range to select this link points to. Must be contained
   * in `LocationLink.range`.
   */
  targetSelectionRange?: Range;
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

export type CompletionType =
  | 'method'
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

/**
 * A completion item represents a text snippet that is
 * proposed to complete text that is being typed.
 */
export interface CompletionItem {
  /**
   * The label of this completion item. By default
   * this is also the text that is inserted when selecting
   * this completion.
   */
  label: string | CompletionItemLabel;
  /**
   * The kind of this completion item. Based on the kind
   * an icon is chosen by the editor.
   */
  kind: CompletionItemKind;
  /**
   * A modifier to the `kind` which affect how the item
   * is rendered, e.g. Deprecated is rendered with a strikeout
   */
  tags?: ReadonlyArray<CompletionItemTag>;
  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;
  /**
   * A human-readable string that represents a doc-comment.
   */
  documentation?: string | IMarkdownString;
  /**
   * A string that should be used when comparing this item
   * with other items. When `falsy` the [label](#CompletionItem.label)
   * is used.
   */
  sortText?: string;
  /**
   * A string that should be used when filtering a set of
   * completion items. When `falsy` the [label](#CompletionItem.label)
   * is used.
   */
  filterText?: string;
  /**
   * Select this item when showing. *Note* that only one completion item can be selected and
   * that the editor decides which item that is. The rule is that the *first* item of those
   * that match best is selected.
   */
  preselect?: boolean;
  /**
   * A string or snippet that should be inserted in a document when selecting
   * this completion.
   * is used.
   */
  insertText: string;
  /**
   * Addition rules (as bitmask) that should be applied when inserting
   * this completion.
   */
  insertTextRules?: CompletionItemInsertTextRule;
  /**
   * A range of text that should be replaced by this completion item.
   *
   * Defaults to a range from the start of the [current word](#TextDocument.getWordRangeAtPosition) to the
   * current position.
   *
   * *Note:* The range must be a [single line](#Range.isSingleLine) and it must
   * [contain](#Range.contains) the position at which completion has been [requested](#CompletionItemProvider.provideCompletionItems).
   */
  range?: IRange | { insert: IRange; replace: IRange };
  /**
   * An optional set of characters that when pressed while this completion is active will accept it first and
   * then type that character. *Note* that all commit characters should have `length=1` and that superfluous
   * characters will be ignored.
   */
  commitCharacters?: string[];
  /**
   * An optional array of additional text edits that are applied when
   * selecting this completion. Edits must not overlap with the main edit
   * nor with themselves.
   */
  additionalTextEdits?: ISingleEditOperation[];
  /**
   * A command that should be run upon acceptance of this item.
   */
  command?: VSCommand;

  /**
   * @internal
   */
  [key: string]: any;
}

export interface CompletionList {
  suggestions: CompletionItem[];
  incomplete?: boolean;
  dispose?(): void;
}

export interface SingleEditOperation {
  range: Range;
  text: string;
  /**
   * This indicates that this operation has "insert" semantics.
   * i.e. forceMoveMarkers = true => if `range` is collapsed, all markers at the position will be moved.
   */
  forceMoveMarkers?: boolean;
  /**
   * This indicates that this operation only has diff patch
   */
  onlyPatch?: boolean;
}

export type SnippetType = 'internal' | 'textmate';

export interface VSCommand {
  id: string;
  title: string;
  tooltip?: string;
  arguments?: any[];
}

export class IdObject {
  id?: number;
}

export enum CompletionItemInsertTextRule {
  /**
   * Adjust whitespace/indentation of multiline insert texts to
   * match the current line indentation.
   */
  KeepWhitespace = 1,
  /**
   * `insertText` is a snippet.
   */
  InsertAsSnippet = 4,
}

export type Definition = Location | Location[];

export interface DefinitionLink {
  uri: UriComponents;
  range: Range;
  origin?: Range;
  selectionRange?: Range;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FoldingContext {}

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
  public constructor(public value: string) {}
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
  eol?: editor.EndOfLineSequence;
}

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

export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
}

export interface CodeLens {
  range: IRange;
  cacheId?: ChainedCacheId;
  command?: VSCommand;
}

export interface ICodeLensListDto {
  cacheId?: number;
  lenses: CodeLens[];
}

export interface CodeLensList {
  lenses: CodeLens[];
  dispose(): void;
}

export interface WorkspaceEditDto extends languages.WorkspaceEdit {
  rejectReason?: string;
}

export type IWorkspaceEditDto = WorkspaceEditDto;

export interface FileOperationOptions {
  overwrite?: boolean;
  ignoreIfExists?: boolean;
  ignoreIfNotExists?: boolean;
  recursive?: boolean;
}

export type ResourceFileEditDto = languages.WorkspaceFileEdit;

export type ResourceTextEditDto = languages.WorkspaceTextEdit;

export interface DocumentLink {
  range: Range;
  url?: string;
}

/**
 * Value-object that contains additional information when
 * requesting references.
 */
export interface ReferenceContext {
  /**
   * Include the declaration of the current symbol.
   */
  includeDeclaration: boolean;
}

export interface ILink {
  range: IRange;
  url?: URI | string;
  tooltip?: string;
}

export interface ILinksList {
  links: ILink[];
  dispose?(): void;
}

export interface ILinkDto extends ILink {
  cacheId?: ChainedCacheId;
}

export interface ILinksListDto {
  id?: CacheId;
  links: ILink[];
}

export interface DocumentSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  tags: ReadonlyArray<SymbolTag>;
  containerName?: string;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export interface WorkspaceSymbolProvider {
  provideWorkspaceSymbols(params: WorkspaceSymbolParams, token: CancellationToken): Thenable<SymbolInformation[]>;
  resolveWorkspaceSymbol(symbol: SymbolInformation, token: CancellationToken): Thenable<SymbolInformation>;
}

export interface IWorkspaceSymbol {
  name: string;
  containerName?: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  location: Location;
}

export interface WorkspaceSymbolParams {
  query: string;
}

export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string | IMarkdownString;
}

export interface SignatureInformation {
  label: string;
  documentation?: string | IMarkdownString;
  parameters: ParameterInformation[];
  activeParameter?: number;
}

export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

export interface ISignatureHelpDto extends SignatureHelp {
  id: number;
}

export interface SignatureHelpResult extends IDisposable {
  value: SignatureHelp;
}

export interface RenameLocation {
  range: Range;
  text: string;
}

export interface Rejection {
  rejectReason?: string;
}

export interface ISerializedSignatureHelpProviderMetadata {
  readonly triggerCharacters: readonly string[];
  readonly retriggerCharacters: readonly string[];
}

export interface SignatureHelpContextDto {
  readonly triggerKind: SignatureHelpTriggerKind;
  readonly triggerCharacter?: string;
  readonly isRetrigger: boolean;
  readonly activeSignatureHelp?: SignatureHelpDto;
}

export enum SignatureHelpTriggerKind {
  Invoke = 1,
  TriggerCharacter = 2,
  ContentChange = 3,
}

export interface SignatureHelpDto {
  id: CacheId;
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

export type CacheId = number;

export type ChainedCacheId = [CacheId, CacheId];

export enum CompletionItemKind {
  Method,
  Function,
  Constructor,
  Field,
  Variable,
  Class,
  Struct,
  Interface,
  Module,
  Property,
  Event,
  Operator,
  Unit,
  Value,
  Constant,
  Enum,
  EnumMember,
  Keyword,
  Text,
  Color,
  File,
  Reference,
  Customcolor,
  Folder,
  TypeParameter,
  User,
  Issue,
  Snippet, // <- highest value (used for compare!)
}

export enum CompletionItemTag {
  Deprecated = 1,
}

/**
 * Mapped-type that replaces all occurrences of URI with UriComponents and
 * drops all functions.
 */
export type Dto<T> = T extends { toJSON(): infer U } ? U : T extends object ? { [k in keyof T]: Dto<T[k]> } : T;

export type ICallHierarchyItemDto = Dto<CallHierarchyItem>;

export interface IIncomingCallDto {
  from: ICallHierarchyItemDto;
  fromRanges: IRange[];
}

export interface IOutgoingCallDto {
  fromRanges: IRange[];
  to: ICallHierarchyItemDto;
}

/**
 * TODO: From vs/editor/common/core/range
 */
export function isIRange(obj: any): obj is Range {
  return (
    obj &&
    typeof obj.startLineNumber === 'number' &&
    typeof obj.startColumn === 'number' &&
    typeof obj.endLineNumber === 'number' &&
    typeof obj.endColumn === 'number'
  );
}

export function isLocationLink(thing: any): thing is LocationLink {
  return (
    thing &&
    URI.isUri((thing as LocationLink).uri) &&
    isIRange((thing as LocationLink).range) &&
    (isIRange((thing as LocationLink).originSelectionRange) || isIRange((thing as LocationLink).targetSelectionRange))
  );
}

export interface SemanticTokensLegend {
  readonly tokenTypes: string[];
  readonly tokenModifiers: string[];
}

export interface SemanticTokens {
  readonly resultId?: string;
  readonly data: Uint32Array;
}

export interface SemanticTokensEdit {
  readonly start: number;
  readonly deleteCount: number;
  readonly data?: Uint32Array;
}

export interface SemanticTokensEdits {
  readonly resultId?: string;
  readonly edits: SemanticTokensEdit[];
}

export interface WithDuration<T> {
  _dur: number;
  result: T;
}

/**
 * A provider of folding ranges for editor models.
 */
export interface FoldingRangeProvider {
  /**
   * An optional event to signal that the folding ranges from this provider have changed.
   */
  onDidChange?: Event<this>;

  /**
   * Provides the folding ranges for a specific model.
   */
  provideFoldingRanges(
    model: editor.ITextModel,
    context: FoldingContext,
    token: CancellationToken,
  ): vscode.ProviderResult<FoldingRange[]>;
}

export const FoldingRangeProviderRegistry = new LanguageFeatureRegistry<FoldingRangeProvider>();
