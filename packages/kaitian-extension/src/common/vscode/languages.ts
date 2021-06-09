import {
  DocumentSelector,
  CompletionItemProvider,
  CancellationToken,
  DefinitionProvider,
  TypeDefinitionProvider,
  FoldingRangeProvider,
  FoldingContext,
  DocumentColorProvider,
  DocumentRangeFormattingEditProvider,
  DocumentFormattingEditProvider,
  CallHierarchyProvider,
} from 'vscode';
import {
  SerializedDocumentFilter,
  Hover,
  Position,
  Range,
  Definition,
  DefinitionLink,
  FoldingRange,
  RawColorInfo,
  ColorPresentation,
  DocumentHighlight,
  FormattingOptions,
  SingleEditOperation,
  SerializedLanguageConfiguration,
  ReferenceContext,
  Location,
  ILink,
  DocumentSymbol,
  WorkspaceEditDto,
  RenameLocation,
  Selection,
  ISerializedSignatureHelpProviderMetadata,
  SelectionRange,
  ICallHierarchyItemDto,
  IOutgoingCallDto,
  IIncomingCallDto,
  CodeLensList,
  CodeLens,
  SemanticTokensLegend,
  WithDuration,
  CompletionItemInsertTextRule,
  CompletionItemLabel,
  IMarkdownString,
  CompletionItemKind,
  CompletionItemTag,
  ChainedCacheId,
} from './model.api';
import type { editor } from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import type {
  CodeActionContext,
  CodeActionList,
  SignatureHelpContext,
  SignatureHelpResult,
  Command,
} from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { Disposable } from './ext-types';
import { SymbolInformation } from 'vscode-languageserver-types';
import globToRegExp = require('glob-to-regexp');
import { IMarkerData, IRange, Uri, UriComponents } from '@ali/ide-core-common';
import { CompletionContext } from './model.api';
import { IEvaluatableExpression } from '@ali/ide-debug/lib/common/evaluatable-expression';
import { ISingleEditOperation } from '@ali/ide-editor';

export interface IMainThreadLanguages {
  $unregister(handle: number): void;
  $registerDocumentHighlightProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerHoverProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $getLanguages(): string[];
  $changeLanguage(resource: UriComponents, languageId: string): Promise<void>;
  $registerCompletionSupport(
    handle: number,
    selector: SerializedDocumentFilter[],
    triggerCharacters: string[],
    supportsResolveDetails: boolean,
  ): void;
  $registerDefinitionProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerTypeDefinitionProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerFoldingRangeProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerDocumentColorProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerDocumentFormattingProvider(
    handle: number,
    displayName: string,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerRangeFormattingProvider(
    handle: number,
    displayName: string,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerOnTypeFormattingProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    triggerCharacter: string[],
  ): void;
  $registerCodeLensSupport(
    handle: number,
    selector: SerializedDocumentFilter[],
    eventHandle?: number,
  ): void;
  $emitCodeLensEvent(eventHandle: number, event?: any): void;
  $clearDiagnostics(id: string): void;
  $changeDiagnostics(id: string, delta: [string, IMarkerData[]][]): void;
  $registerQuickFixProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
    codeActionKinds?: string[],
  ): void;
  $registerImplementationProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $setLanguageConfiguration(
    handle: number,
    languageId: string,
    configuration: SerializedLanguageConfiguration,
  ): void;
  $registerReferenceProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerDocumentLinkProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerOutlineSupport(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
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
  $registerSelectionRangeProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerDeclarationProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
  $registerCallHierarchyProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
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
  $registerEvaluatableExpressionProvider(
    handle: number,
    selector: SerializedDocumentFilter[],
  ): void;
}

export interface IExtHostLanguages {
  getLanguages(): Promise<string[]>;

  registerHoverProvider(selector, provider): Disposable;
  $provideHover(
    handle: number,
    resource: any,
    position: any,
    token: any,
  ): Promise<Hover | undefined>;
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
  ): Disposable;

  registerFoldingRangeProvider(
    selector: DocumentSelector,
    provider: FoldingRangeProvider,
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
  ): Disposable;
  $provideDocumentColors(
    handle: number,
    resource: UriComponents,
    token: CancellationToken,
  ): Promise<RawColorInfo[]>;
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
    displayName: string,
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
    displayName: string,
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
  ): Promise<CodeLensList | undefined>;
  $resolveCodeLens(
    handle: number,
    resource: UriComponents,
    codeLens: CodeLens,
  ): Promise<CodeLens | undefined>;

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
  ): Promise<CodeActionList | undefined>;

  $provideDocumentLinks(
    handle: number,
    resource: UriComponents,
    token: CancellationToken,
  ): Promise<ILink[] | undefined>;
  $resolveDocumentLink(
    handle: number,
    link: ILink,
    token: CancellationToken,
  ): Promise<ILink | undefined>;

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

  $provideWorkspaceSymbols(
    handle: number,
    query: string,
    token: CancellationToken,
  ): PromiseLike<SymbolInformation[]>;
  $resolveWorkspaceSymbol(
    handle: number,
    symbol: SymbolInformation,
    token: CancellationToken,
  ): PromiseLike<SymbolInformation>;

  $provideSignatureHelp(
    handle: number,
    resource: UriComponents,
    position: Position,
    context: SignatureHelpContext,
    token: CancellationToken,
  ): Promise<SignatureHelpResult | undefined | null>;

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

  $provideSelectionRanges(
    handle: number,
    resource: UriComponents,
    positions: Position[],
    token: CancellationToken,
  ): Promise<SelectionRange[][]>;

  registerCallHierarchyProvider(
    selector: DocumentSelector,
    provider: CallHierarchyProvider,
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
  $provideDocumentSemanticTokens(
    handle: number,
    resource: UriComponents,
    previousResultId: number,
    token: CancellationToken,
  ): Promise<Uint8Array | null>;
  $releaseDocumentSemanticTokens(
    handle: number,
    semanticColoringResultId: number,
  ): void;
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
}

export const enum ISuggestResultDtoField {
  defaultRanges = 'a',
  completions = 'b',
  isIncomplete = 'c',
  duration = 'd',
}

export const enum ISuggestDataDtoField {
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

  // to merge into label
  label2 = 'o',
}

export interface ISuggestResultDto {
  [ISuggestResultDtoField.defaultRanges]: { insert: IRange, replace: IRange; };
  [ISuggestResultDtoField.completions]: ISuggestDataDto[];
  [ISuggestResultDtoField.isIncomplete]: undefined | true;
  [ISuggestResultDtoField.duration]: number;
  x?: number;
}

export interface ISuggestDataDto {
  [ISuggestDataDtoField.label]: string;
  [ISuggestDataDtoField.label2]?: string | CompletionItemLabel;
  [ISuggestDataDtoField.kind]?: CompletionItemKind;
  [ISuggestDataDtoField.detail]?: string;
  [ISuggestDataDtoField.documentation]?: string | IMarkdownString;
  [ISuggestDataDtoField.sortText]?: string;
  [ISuggestDataDtoField.filterText]?: string;
  [ISuggestDataDtoField.preselect]?: true;
  [ISuggestDataDtoField.insertText]?: string;
  [ISuggestDataDtoField.insertTextRules]?: CompletionItemInsertTextRule;
  [ISuggestDataDtoField.range]?: IRange | { insert: IRange; replace: IRange };
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
  export function fromDocument(
    document: DocumentIdentifier,
  ): MonacoModelIdentifier {
    return {
      uri: Uri.parse(document.uri),
      languageId: document.languageId,
    };
  }
  export function fromModel(
    model: editor.IReadOnlyModel,
  ): MonacoModelIdentifier {
    return {
      uri: model.uri,
      languageId: model.getModeId(),
    };
  }
}
