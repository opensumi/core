import globToRegExp from 'glob-to-regexp';
import {
  CallHierarchyProvider,
  CancellationToken,
  CompletionItemProvider,
  DefinitionProvider,
  DocumentColorProvider,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  DocumentSelector,
  FoldingContext,
  FoldingRangeProvider,
  InlayHintsProvider,
  InlineCompletionItemProvider,
  InlineCompletionItemProviderMetadata,
  TypeDefinitionProvider,
  TypeHierarchyProvider,
  // eslint-disable-next-line import/no-unresolved
} from 'vscode';
import { SymbolInformation } from 'vscode-languageserver-types';

import { IMarkdownString, IMarkerData, IRange, UriComponents } from '@opensumi/ide-core-common';
import { IEvaluatableExpression } from '@opensumi/ide-debug/lib/common/evaluatable-expression';
import { InlineValue, InlineValueContext } from '@opensumi/ide-debug/lib/common/inline-values';
// eslint-disable-next-line import/order
import { ILanguageStatus, ISingleEditOperation } from '@opensumi/ide-editor';

// eslint-disable-next-line import/no-restricted-paths
import { URI as Uri } from '@opensumi/monaco-editor-core/esm/vs/base/common/uri';
import { Range as MonacoRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

import { IDocumentFilterDto } from './converter';
import { Disposable } from './ext-types';
import { IExtensionDescription } from './extension';
import {
  CacheId,
  ChainedCacheId,
  CodeLens,
  ColorPresentation,
  CompletionContext,
  CompletionItemInsertTextRule,
  CompletionItemKind,
  CompletionItemTag,
  Definition,
  DefinitionLink,
  DocumentHighlight,
  DocumentSymbol,
  FoldingRange,
  FormattingOptions,
  Hover,
  ICallHierarchyItemDto,
  ICodeLensListDto,
  IIncomingCallDto,
  ILink,
  ILinksListDto,
  IOutgoingCallDto,
  ISerializedSignatureHelpProviderMetadata,
  ISignatureHelpDto,
  ITypeHierarchyItemDto,
  IWorkspaceEditDto,
  Location,
  Position,
  Range,
  RawColorInfo,
  ReferenceContext,
  RenameLocation,
  Selection,
  SelectionRange,
  SemanticTokensLegend,
  SerializedDocumentFilter,
  SerializedLanguageConfiguration,
  SerializedRegExp,
  SingleEditOperation,
  WithDuration,
  WorkspaceEditDto,
} from './model.api';

// eslint-disable-next-line import/no-restricted-paths
import type { ITextModel, NewSymbolName } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
// eslint-disable-next-line import/no-restricted-paths
import type {
  CodeActionContext,
  Command,
  CompletionItemLabel,
  SignatureHelpContext,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

export interface IMainThreadLanguages {
  $unregister(handle: number): void;
  $registerDocumentHighlightProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $getLanguages(): string[];
  $changeLanguage(resource: UriComponents, languageId: string): Promise<void>;
  $registerCompletionSupport(
    handle: number,
    selector: SerializedDocumentFilter[],
    triggerCharacters: string[],
    supportsResolveDetails: boolean,
  ): void;
  $registerInlineCompletionsSupport(
    handle: number,
    selector: IDocumentFilterDto[],
    supportsHandleDidShowCompletionItem: boolean,
    extensionId: string,
    yieldsToExtensionIds: string[],
  ): void;
  $registerDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerTypeDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerFoldingRangeProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    eventHandle: number | undefined,
  ): void;
  $emitFoldingRangeEvent(eventHandle: number, event?: any): void;
  $registerDocumentColorProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDocumentFormattingProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerRangeFormattingProvider(
    handle: number,
    extension: IExtensionDescription,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerOnTypeFormattingProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    triggerCharacter: string[],
  ): void;
  $registerCodeLensSupport(handle: number, selector: SerializedDocumentFilter[], eventHandle?: number): void;
  $emitCodeLensEvent(eventHandle: number, event?: any): void;
  $clearDiagnostics(id: string): void;
  $changeDiagnostics(id: string, delta: [string, IMarkerData[]][]): void;
  $registerQuickFixProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    metadata: ICodeActionProviderMetadataDto,
    displayName: string,
    supportResolve: boolean,
  ): void;
  $registerImplementationProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void;
  $registerReferenceProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[], supportResolve: boolean): void;
  $registerOutlineSupport(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerWorkspaceSymbolProvider(handle: number): void;
  $registerSignatureHelpProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    metadata: ISerializedSignatureHelpProviderMetadata,
  ): void;
  $registerRenameProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    supportsResoveInitialValues: boolean,
  ): void;
  $registerNewSymbolNamesProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerSelectionRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDeclarationProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerCallHierarchyProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerTypeHierarchyProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDocumentSemanticTokensProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    legend: SemanticTokensLegend,
  ): void;
  $registerDocumentRangeSemanticTokensProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    legend: SemanticTokensLegend,
  ): void;
  $registerEvaluatableExpressionProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerInlineValuesProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    eventHandle: number | undefined,
  ): void;
  $emitInlineValuesEvent(eventHandle: number, event?: any): void;
  $registerLinkedEditingRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerInlayHintsProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    supportsResolve: boolean,
    eventHandle: number | undefined,
    displayName: string | undefined,
  ): void;
  $emitInlayHintsEvent(eventHandle: number, event?: any): void;
  $setLanguageStatus(handle: number, status: ILanguageStatus): void;
  $removeLanguageStatus(handle: number): void;
}

export interface IExtHostLanguages {
  getLanguages(): Promise<string[]>;

  registerHoverProvider(selector, provider, extension: IExtensionDescription): Disposable;
  $provideHover(handle: number, resource: any, position: any, token: any): Promise<Hover | undefined>;
  $provideHoverWithDuration(
    handle: number,
    resource: any,
    position: any,
    token: any,
  ): Promise<WithDuration<Hover | undefined>>;

  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    triggerCharacters: string[],
    extension: IExtensionDescription,
  ): Disposable;
  $provideCompletionItems(
    handle: number,
    resource: UriComponents,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
  ): Promise<ISuggestResultDto | undefined>;
  $resolveCompletionItem(
    handle: number,
    id: ChainedCacheId,
    token: CancellationToken,
  ): Promise<ISuggestDataDto | undefined>;
  $releaseCompletionItems(handle: number, id: number): void;

  registerInlineCompletionsProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: InlineCompletionItemProvider,
    metadata: InlineCompletionItemProviderMetadata | undefined,
  ): Disposable;
  $provideInlineCompletions(
    handle: number,
    resource: UriComponents,
    position: Position,
    context: languages.InlineCompletionContext,
    token: CancellationToken,
  ): Promise<IdentifiableInlineCompletions | undefined>;
  $handleInlineCompletionDidShow(handle: number, pid: number, idx: number, updatedInsertText: string): void;
  $handleInlineCompletionPartialAccept(handle: number, pid: number, idx: number, acceptedCharacters: number): void;
  $freeInlineCompletionsList(handle: number, pid: number): void;

  $provideDefinition(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined>;
  $provideDefinitionWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<WithDuration<Definition | DefinitionLink[] | undefined>>;
  registerDefinitionProvider(
    selector: DocumentSelector,
    provider: DefinitionProvider,
    extension: IExtensionDescription,
  ): Disposable;

  $provideTypeDefinition(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined>;
  registerTypeDefinitionProvider(
    selector: DocumentSelector,
    provider: TypeDefinitionProvider,
    extension: IExtensionDescription,
  ): Disposable;

  registerFoldingRangeProvider(
    selector: DocumentSelector,
    provider: FoldingRangeProvider,
    extension: IExtensionDescription,
  ): Disposable;
  $provideFoldingRange(
    handle: number,
    resource: UriComponents,
    context: FoldingContext,
    token: CancellationToken,
  ): Promise<FoldingRange[] | undefined>;

  registerColorProvider(
    selector: DocumentSelector,
    provider: DocumentColorProvider,
    extension: IExtensionDescription,
  ): Disposable;
  $provideDocumentColors(handle: number, resource: UriComponents, token: CancellationToken): Promise<RawColorInfo[]>;
  $provideColorPresentations(
    handle: number,
    resource: UriComponents,
    colorInfo: RawColorInfo,
    token: CancellationToken,
  ): PromiseLike<ColorPresentation[]>;

  $provideDocumentHighlights(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | undefined>;

  registerDocumentRangeFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentRangeFormattingEditProvider,
  ): Disposable;
  $provideDocumentRangeFormattingEdits(
    handle: number,
    resource: UriComponents,
    range: Range,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined>;

  registerDocumentFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentFormattingEditProvider,
  ): Disposable;
  $provideDocumentFormattingEdits(
    handle: number,
    resource: UriComponents,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined>;

  $provideOnTypeFormattingEdits(
    handle: number,
    resource: UriComponents,
    position: Position,
    ch: string,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined>;
  $provideOnTypeFormattingEditsWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    ch: string,
    options: FormattingOptions,
  ): Promise<WithDuration<SingleEditOperation[] | undefined>>;

  $provideCodeLenses(
    handle: number,
    resource: UriComponents,
    token: CancellationToken,
  ): Promise<ICodeLensListDto | undefined>;
  $resolveCodeLens(handle: number, codeLens: CodeLens, token: CancellationToken): Promise<CodeLens | undefined>;
  $releaseCodeLens(handle: number, cacheId: number): Promise<void>;

  $provideImplementation(
    handle: number,
    resource: UriComponents,
    position: Position,
  ): Promise<Definition | DefinitionLink[] | undefined>;
  $provideImplementationWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
  ): Promise<WithDuration<Definition | DefinitionLink[] | undefined>>;

  $provideCodeActions(
    handle: number,
    resource: UriComponents,
    rangeOrSelection: Range | Selection,
    context: CodeActionContext,
    token: CancellationToken,
  ): Promise<ICodeActionListDto | undefined>;
  $resolveCodeAction(
    handle: number,
    id: ChainedCacheId,
    token: CancellationToken,
  ): Promise<IWorkspaceEditDto | undefined>;
  $releaseCodeActions(handle: number, cacheId: number): void;

  $provideDocumentLinks(
    handle: number,
    resource: UriComponents,
    token: CancellationToken,
  ): Promise<ILinksListDto | undefined>;
  $resolveDocumentLink(handle: number, id: ChainedCacheId, token: CancellationToken): Promise<ILink | undefined>;
  $releaseDocumentLinks(handle: number, id: number): void;

  $provideReferences(
    handle: number,
    resource: UriComponents,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[] | undefined>;
  $provideReferencesWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<WithDuration<Location[] | undefined>>;

  $provideDocumentSymbols(
    handle: number,
    resource: UriComponents,
    token: CancellationToken,
  ): Promise<DocumentSymbol[] | undefined>;

  $provideWorkspaceSymbols(handle: number, query: string, token: CancellationToken): PromiseLike<SymbolInformation[]>;
  $resolveWorkspaceSymbol(
    handle: number,
    symbol: SymbolInformation,
    token: CancellationToken,
  ): PromiseLike<SymbolInformation | undefined>;

  $provideSignatureHelp(
    handle: number,
    resource: UriComponents,
    position: Position,
    context: SignatureHelpContext,
    token: CancellationToken,
  ): Promise<ISignatureHelpDto | undefined | null>;

  $releaseSignatureHelp(handle: number, cacheId: number): Promise<void>;

  $provideRenameEdits(
    handle: number,
    resource: UriComponents,
    position: Position,
    newName: string,
    token: CancellationToken,
  ): PromiseLike<WorkspaceEditDto | undefined>;
  $resolveRenameLocation(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): PromiseLike<RenameLocation | undefined>;

  $provideNewSymbolNames(
    handle: number,
    resource: Uri,
    range: Range,
    token: CancellationToken,
  ): Promise<NewSymbolName[] | undefined>;

  $provideSelectionRanges(
    handle: number,
    resource: UriComponents,
    positions: Position[],
    token: CancellationToken,
  ): Promise<SelectionRange[][]>;

  registerCallHierarchyProvider(
    selector: DocumentSelector,
    provider: CallHierarchyProvider,
    extension: IExtensionDescription,
  ): Disposable;
  $prepareCallHierarchy(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ICallHierarchyItemDto[] | undefined>;
  $releaseCallHierarchy(handle: number, sessionId: string): void;
  $provideCallHierarchyIncomingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IIncomingCallDto[] | undefined>;
  $provideCallHierarchyOutgoingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IOutgoingCallDto[] | undefined>;
  registerTypeHierarchyProvider(
    selector: DocumentSelector,
    provider: TypeHierarchyProvider,
    extension: IExtensionDescription,
  ): Disposable;
  $prepareTypeHierarchy(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ICallHierarchyItemDto[] | undefined>;
  $provideTypeHierarchySupertypes(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<ITypeHierarchyItemDto[] | undefined>;
  $provideTypeHierarchySubtypes(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<ITypeHierarchyItemDto[] | undefined>;
  $releaseTypeHierarchy(handle: number, sessionId: string): void;
  $provideDocumentSemanticTokens(
    handle: number,
    resource: UriComponents,
    previousResultId: number,
    token: CancellationToken,
  ): Promise<Uint8Array | null>;
  $releaseDocumentSemanticTokens(handle: number, semanticColoringResultId: number): void;
  $provideDocumentRangeSemanticTokens(
    handle: number,
    resource: UriComponents,
    range: Range,
    token: CancellationToken,
  ): Promise<Uint8Array | null>;

  $provideEvaluatableExpression(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<IEvaluatableExpression | undefined>;

  $provideInlineValues(
    handle: number,
    resource: UriComponents,
    range: IRange,
    context: InlineValueContext,
    token: CancellationToken,
  ): Promise<InlineValue[] | undefined>;

  $provideLinkedEditingRanges(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ILinkedEditingRangesDto | undefined>;
  registerInlayHintsProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: InlayHintsProvider,
  ): Disposable;
  $provideInlayHints(
    handle: number,
    resource: UriComponents,
    range: IRange,
    token: CancellationToken,
  ): Promise<IInlayHintsDto | undefined>;
  $resolveInlayHint(handle: number, id: ChainedCacheId, token: CancellationToken): Promise<IInlayHintDto | undefined>;
  $releaseInlayHints(handle: number, id: number): void;
}

export interface ILinkedEditingRangesDto {
  ranges: IRange[];
  wordPattern?: SerializedRegExp;
}

export interface IInlayHintDto {
  label: string | languages.InlayHintLabelPart[];
  tooltip?: string | IMarkdownString;
  textEdits?: languages.TextEdit[];
  position: Position;
  kind?: languages.InlayHintKind;
  paddingLeft?: boolean;
  paddingRight?: boolean;
  cacheId?: ChainedCacheId;
}

export interface IInlayHintsDto {
  hints: IInlayHintDto[];
  cacheId?: CacheId;
}

export interface IInlineValueContextDto {
  frameId: number;
  stoppedLocation: IRange;
}

export enum ISuggestResultDtoField {
  defaultRanges = 'a',
  completions = 'b',
  isIncomplete = 'c',
  duration = 'd',
}

export enum ISuggestDataDtoField {
  label = 'a',
  kind = 'b',
  detail = 'c',
  documentation = 'd',
  sortText = 'e',
  filterText = 'f',
  preselect = 'g',
  insertText = 'h',
  insertTextRules = 'i',
  range = 'j',
  commitCharacters = 'k',
  additionalTextEdits = 'l',
  command = 'm',
  kindModifier = 'n',
}

export namespace RangeSuggestDataDto {
  export type ISuggestRangeDto = [number, number, number, number];
  export function to(range: Range) {
    return [range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn] as ISuggestRangeDto;
  }
  export function from(range: ISuggestRangeDto | { insert: IRange; replace: IRange }) {
    return Array.isArray(range) && range.length === 4
      ? MonacoRange.lift({
          startLineNumber: range[0],
          startColumn: range[1],
          endLineNumber: range[2],
          endColumn: range[3],
        })
      : range;
  }
}

export interface ISuggestResultDto {
  [ISuggestResultDtoField.defaultRanges]: { insert: IRange; replace: IRange };
  [ISuggestResultDtoField.completions]: ISuggestDataDto[];
  [ISuggestResultDtoField.isIncomplete]: undefined | true;
  [ISuggestResultDtoField.duration]: number;
  /** 缓存在插件进程的评论列表 id */
  // not-standard
  x?: number;
}

export interface ISuggestDataDto {
  [ISuggestDataDtoField.label]: string | CompletionItemLabel;
  [ISuggestDataDtoField.kind]?: CompletionItemKind;
  [ISuggestDataDtoField.detail]?: string;
  [ISuggestDataDtoField.documentation]?: string | IMarkdownString;
  [ISuggestDataDtoField.sortText]?: string;
  [ISuggestDataDtoField.filterText]?: string;
  [ISuggestDataDtoField.preselect]?: true;
  [ISuggestDataDtoField.insertText]?: string;
  [ISuggestDataDtoField.insertTextRules]?: CompletionItemInsertTextRule;
  [ISuggestDataDtoField.range]?: RangeSuggestDataDto.ISuggestRangeDto | { insert: IRange; replace: IRange };
  [ISuggestDataDtoField.commitCharacters]?: string[];
  [ISuggestDataDtoField.additionalTextEdits]?: ISingleEditOperation[];
  [ISuggestDataDtoField.command]?: Command;
  [ISuggestDataDtoField.kindModifier]?: CompletionItemTag[];
  // not-standard
  x?: ChainedCacheId;
}

export function testGlob(pattern: string, value: string): boolean {
  const regExp = globToRegExp(pattern, {
    extended: true,
    globstar: true,
  });
  return regExp.test(value);
}

export interface DocumentIdentifier {
  uri: string;
  languageId: string;
}

export namespace DocumentIdentifier {
  export function is(arg: any): arg is DocumentIdentifier {
    return !!arg && 'uri' in arg && 'languageId' in arg;
  }
}

export interface MonacoModelIdentifier {
  uri: Uri;
  languageId: string;
}

export namespace MonacoModelIdentifier {
  export function fromDocument(document: DocumentIdentifier): MonacoModelIdentifier {
    return {
      uri: Uri.parse(document.uri),
      languageId: document.languageId,
    };
  }
  export function fromModel(model: ITextModel): MonacoModelIdentifier {
    return {
      uri: model.uri,
      languageId: model.getLanguageId(),
    };
  }
}

export interface ICodeActionDto {
  cacheId?: ChainedCacheId;
  title: string;
  edit?: IWorkspaceEditDto;
  diagnostics?: IMarkerData[];
  command?: Command;
  kind?: string;
  isPreferred?: boolean;
  isAI?: boolean;
  disabled?: string;
  ranges?: IRange[];
}

export interface ICodeActionListDto {
  cacheId: CacheId;
  actions: ReadonlyArray<ICodeActionDto>;
}

export interface ICodeActionProviderMetadataDto {
  readonly providedKinds?: readonly string[];
  readonly documentation?: ReadonlyArray<{ readonly kind: string; readonly command: Command }>;
}

// inline completion begin
export interface IdentifiableInlineCompletions extends languages.InlineCompletions<IdentifiableInlineCompletion> {
  pid: number;
}

export interface IdentifiableInlineCompletion extends languages.InlineCompletion {
  idx: number;
}

/**
 * How an {@link InlineCompletionsProvider inline completion provider} was triggered.
 */
export enum InlineCompletionTriggerKind {
  /**
   * Completion was triggered automatically while editing.
   * It is sufficient to return a single completion item in this case.
   */
  Automatic = 0,

  /**
   * Completion was triggered explicitly by a user gesture.
   * Return multiple completion items to enable cycling through them.
   */
  Explicit = 1,
}

export interface InlineCompletionContext {
  /**
   * How the completion was triggered.
   */
  readonly triggerKind: InlineCompletionTriggerKind;

  readonly selectedSuggestionInfo: SelectedSuggestionInfo | undefined;
}

export interface SelectedSuggestionInfo {
  range: IRange;
  text: string;
  isSnippetText: boolean;
  completionKind: CompletionItemKind;
  equals(other: SelectedSuggestionInfo): boolean;
}

// inline completion end
