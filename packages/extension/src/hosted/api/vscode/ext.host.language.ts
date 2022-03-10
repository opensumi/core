/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostLanguageFeatures.ts

import vscode from 'vscode';
import {
  DocumentSelector,
  HoverProvider,
  CancellationToken,
  DocumentHighlightProvider,
  DocumentFilter,
  CompletionItemProvider,
  DefinitionProvider,
  TypeDefinitionProvider,
  FoldingRangeProvider,
  FoldingContext,
  DocumentColorProvider,
  DocumentRangeFormattingEditProvider,
  OnTypeFormattingEditProvider,
  CodeLensProvider,
  CodeActionProvider,
  CodeActionProviderMetadata,
  ImplementationProvider,
  DeclarationProvider,
  Diagnostic,
  DiagnosticCollection,
  DocumentLinkProvider,
  ReferenceProvider,
  TextDocument,
  LanguageConfiguration,
  DocumentSymbolProvider,
  WorkspaceSymbolProvider,
  SignatureHelpProvider,
  RenameProvider,
  SignatureHelpProviderMetadata,
  Event,
  DiagnosticChangeEvent,
  SelectionRangeProvider,
  DocumentFormattingEditProvider,
  CallHierarchyProvider,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend,
  DocumentRangeSemanticTokensProvider,
  EvaluatableExpressionProvider,
  InlineValuesProvider,
  LinkedEditingRangeProvider,
} from 'vscode';
import { SymbolInformation } from 'vscode-languageserver-types';

import { ConstructorOf } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  DisposableStore,
  disposableTimeout,
  IDisposable,
  IExtensionLogger,
  Severity,
  Uri,
  UriComponents,
} from '@opensumi/ide-core-common';
import { InlineValue } from '@opensumi/ide-debug/lib/common/inline-values';
import type { CodeActionContext } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import {
  IMainThreadLanguages,
  MainThreadAPIIdentifier,
  ExtensionDocumentDataManager,
  IExtHostLanguages,
  ISuggestDataDto,
  IExtensionDescription,
  ICodeActionListDto,
  IInlineValueContextDto,
  ILinkedEditingRangesDto,
} from '../../../common/vscode';
import * as typeConvert from '../../../common/vscode/converter';
import { CancellationError, Disposable, LanguageStatusSeverity } from '../../../common/vscode/ext-types';
import {
  SerializedDocumentFilter,
  Hover,
  Position,
  Range,
  Selection,
  CompletionContext,
  Definition,
  DefinitionLink,
  FoldingRange,
  RawColorInfo,
  ColorPresentation,
  DocumentHighlight,
  FormattingOptions,
  SingleEditOperation,
  CodeLens,
  ReferenceContext,
  Location,
  SerializedLanguageConfiguration,
  ILink,
  DocumentSymbol,
  WorkspaceEditDto,
  RenameLocation,
  ISerializedSignatureHelpProviderMetadata,
  SignatureHelpContextDto,
  SelectionRange,
  ICallHierarchyItemDto,
  IIncomingCallDto,
  IOutgoingCallDto,
  WithDuration,
  ChainedCacheId,
  ICodeLensListDto,
  ISignatureHelpDto,
  ILinksListDto,
} from '../../../common/vscode/model.api';
import { serializeEnterRules, serializeRegExp, serializeIndentation } from '../../../common/vscode/utils';

import { ExtHostCommands } from './ext.host.command';
import { CallHierarchyAdapter } from './language/callhierarchy';
import { CodeActionAdapter } from './language/code-action';
import { ColorProviderAdapter } from './language/color';
import { CompletionAdapter } from './language/completion';
import { DeclarationAdapter } from './language/declaration';
import { DefinitionAdapter } from './language/definition';
import { Diagnostics } from './language/diagnostics';
import { DocumentHighlightAdapter } from './language/document-highlight';
import { EvaluatableExpressionAdapter } from './language/evaluatableExpression';
import { FoldingProviderAdapter } from './language/folding';
import { HoverAdapter } from './language/hover';
import { ImplementationAdapter } from './language/implementation';
import { InlayHintsAdapter } from './language/inlay-hints';
import { InlineValuesAdapter } from './language/inline-values';
import { CodeLensAdapter } from './language/lens';
import { LinkProviderAdapter } from './language/link-provider';
import { LinkedEditingRangeAdapter } from './language/linked-editing-range';
import { OnTypeFormattingAdapter } from './language/on-type-formatting';
import { OutlineAdapter } from './language/outline';
import { RangeFormattingAdapter, FormattingAdapter } from './language/range-formatting';
import { ReferenceAdapter } from './language/reference';
import { RenameAdapter } from './language/rename';
import { SelectionRangeAdapter } from './language/selection';
import { DocumentRangeSemanticTokensAdapter, DocumentSemanticTokensAdapter } from './language/semantic-tokens';
import { SignatureHelpAdapter } from './language/signature';
import { TypeDefinitionAdapter } from './language/type-definition';
import { getDurationTimer, score } from './language/util';
import { WorkspaceSymbolAdapter } from './language/workspace-symbol';

export function createLanguagesApiFactory(
  extHostLanguages: ExtHostLanguages,
  extension: IExtensionDescription,
): typeof vscode.languages {
  return {
    getLanguages(): Promise<string[]> {
      return extHostLanguages.getLanguages();
    },
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider);
    },
    registerCompletionItemProvider(
      selector: DocumentSelector,
      provider: CompletionItemProvider,
      ...triggerCharacters: string[]
    ): Disposable {
      return extHostLanguages.registerCompletionItemProvider(selector, provider, triggerCharacters);
    },
    registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
      return extHostLanguages.registerDefinitionProvider(selector, provider);
    },
    registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable {
      return extHostLanguages.registerTypeDefinitionProvider(selector, provider);
    },
    registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable {
      return extHostLanguages.registerFoldingRangeProvider(selector, provider);
    },
    registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable {
      return extHostLanguages.registerColorProvider(selector, provider);
    },
    registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
      return extHostLanguages.registerDocumentHighlightProvider(selector, provider);
    },
    registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable {
      return extHostLanguages.registerDocumentLinkProvider(selector, provider);
    },
    registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable {
      return extHostLanguages.registerReferenceProvider(selector, provider);
    },
    match(selector: DocumentSelector, document: TextDocument): number {
      return score(typeConvert.fromLanguageSelector(selector), document.uri, document.languageId, true);
    },
    setLanguageConfiguration(language: string, configuration: LanguageConfiguration): Disposable {
      return extHostLanguages.setLanguageConfiguration(language, configuration);
    },
    setTextDocumentLanguage(document: TextDocument, languageId: string): Thenable<TextDocument> {
      return extHostLanguages.changeLanguage(document.uri, languageId);
    },
    createDiagnosticCollection(name?: string): DiagnosticCollection {
      return extHostLanguages.createDiagnosticCollection(name);
    },
    get onDidChangeDiagnostics(): Event<DiagnosticChangeEvent> {
      return extHostLanguages.onDidChangeDiagnostics;
    },
    getDiagnostics(resource?: Uri) {
      return extHostLanguages.getDiagnostics(resource) as any;
    },
    registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider) {
      return extHostLanguages.registerWorkspaceSymbolProvider(provider);
    },
    registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider) {
      return extHostLanguages.registerDocumentSymbolProvider(selector, provider);
    },
    registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable {
      return extHostLanguages.registerImplementationProvider(selector, provider);
    },
    registerDeclarationProvider(selector: DocumentSelector, provider: DeclarationProvider): Disposable {
      return extHostLanguages.registerDeclarationProvider(selector, provider);
    },
    registerCodeActionsProvider(
      selector: DocumentSelector,
      provider: CodeActionProvider,
      metadata?: CodeActionProviderMetadata,
    ): Disposable {
      return extHostLanguages.registerCodeActionsProvider(extension, selector, provider, metadata);
    },
    registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable {
      return extHostLanguages.registerRenameProvider(selector, provider);
    },
    registerSignatureHelpProvider(
      selector: DocumentSelector,
      provider: SignatureHelpProvider,
      firstItem?: string | SignatureHelpProviderMetadata,
      ...remaining: string[]
    ) {
      if (typeof firstItem === 'object') {
        return extHostLanguages.registerSignatureHelpProvider(selector, provider, firstItem);
      }
      return extHostLanguages.registerSignatureHelpProvider(
        selector,
        provider,
        typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining],
      );
    },
    registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
      return extHostLanguages.registerCodeLensProvider(selector, provider);
    },
    registerOnTypeFormattingEditProvider(
      selector: DocumentSelector,
      provider: OnTypeFormattingEditProvider,
      firstTriggerCharacter: string,
      ...moreTriggerCharacter: string[]
    ): Disposable {
      return extHostLanguages.registerOnTypeFormattingEditProvider(
        selector,
        provider,
        [firstTriggerCharacter].concat(moreTriggerCharacter),
      );
    },
    registerDocumentRangeFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentRangeFormattingEditProvider,
    ): Disposable {
      return extHostLanguages.registerDocumentRangeFormattingEditProvider(extension, selector, provider);
    },
    registerDocumentFormattingEditProvider(
      selector: DocumentSelector,
      provider: DocumentFormattingEditProvider,
    ): Disposable {
      return extHostLanguages.registerDocumentFormattingEditProvider(extension, selector, provider);
    },
    registerSelectionRangeProvider(selector: DocumentSelector, provider: SelectionRangeProvider): Disposable {
      return extHostLanguages.registerSelectionRangeProvider(selector, provider);
    },
    registerCallHierarchyProvider(selector: DocumentSelector, provider: CallHierarchyProvider): Disposable {
      return extHostLanguages.registerCallHierarchyProvider(selector, provider);
    },
    registerDocumentSemanticTokensProvider(
      selector: DocumentSelector,
      provider: DocumentSemanticTokensProvider,
      legend: SemanticTokensLegend,
    ): Disposable {
      return extHostLanguages.registerDocumentSemanticTokensProvider(selector, provider, legend);
    },
    registerDocumentRangeSemanticTokensProvider(
      selector: DocumentSelector,
      provider: DocumentRangeSemanticTokensProvider,
      legend: SemanticTokensLegend,
    ): Disposable {
      return extHostLanguages.registerDocumentRangeSemanticTokensProvider(extension, selector, provider, legend);
    },
    registerEvaluatableExpressionProvider(
      selector: DocumentSelector,
      provider: EvaluatableExpressionProvider,
    ): Disposable {
      return extHostLanguages.registerEvaluatableExpressionProvider(extension, selector, provider);
    },
    registerInlineValuesProvider(selector: DocumentSelector, provider: InlineValuesProvider): Disposable {
      return extHostLanguages.registerInlineValuesProvider(extension, selector, provider);
    },
    registerLinkedEditingRangeProvider(selector: DocumentSelector, provider: LinkedEditingRangeProvider): Disposable {
      return extHostLanguages.registerLinkedEditingRangeProvider(extension, selector, provider);
    },
    registerInlayHintsProvider(
      selector: vscode.DocumentSelector,
      provider: vscode.InlayHintsProvider,
    ): vscode.Disposable {
      return extHostLanguages.registerInlayHintsProvider(extension, selector, provider);
    },
    createLanguageStatusItem(id: string, selector: vscode.DocumentSelector): vscode.LanguageStatusItem {
      return extHostLanguages.createLanguageStatusItem(extension, id, selector);
    },
  };
}

export type Adapter =
  | HoverAdapter
  | CompletionAdapter
  | DefinitionAdapter
  | TypeDefinitionAdapter
  | FoldingProviderAdapter
  | ColorProviderAdapter
  | DocumentHighlightAdapter
  | RangeFormattingAdapter
  | CodeLensAdapter
  | OnTypeFormattingAdapter
  | CodeActionAdapter
  | ImplementationAdapter
  | LinkProviderAdapter
  | OutlineAdapter
  | WorkspaceSymbolAdapter
  | ReferenceAdapter
  | SignatureHelpAdapter
  | SelectionRangeAdapter
  | FormattingAdapter
  | RenameAdapter
  | DeclarationAdapter
  | CallHierarchyAdapter
  | DocumentSemanticTokensAdapter
  | DocumentRangeSemanticTokensAdapter
  | EvaluatableExpressionAdapter
  | InlineValuesAdapter
  | LinkedEditingRangeAdapter
  | InlayHintsAdapter;

export class ExtHostLanguages implements IExtHostLanguages {
  private readonly proxy: IMainThreadLanguages;
  private readonly rpcProtocol: IRPCProtocol;
  private callId = 0;
  private adaptersMap = new Map<number, Adapter>();
  private diagnostics: Diagnostics;

  constructor(
    rpcProtocol: IRPCProtocol,
    private documents: ExtensionDocumentDataManager,
    private commands: ExtHostCommands,
    private logService: IExtensionLogger,
  ) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadLanguages);
    this.diagnostics = new Diagnostics(this.proxy);
  }

  $resolveCodeAction(
    handle: number,
    id: ChainedCacheId,
    token: CancellationToken,
  ): Promise<WorkspaceEditDto | undefined> {
    return this.withAdapter(handle, CodeActionAdapter, (adapter) => adapter.resolveCodeAction(id, token));
  }

  $releaseCodeActions(handle: number, cacheId: number): void {
    this.withAdapter(handle, CodeActionAdapter, (adapter) => Promise.resolve(adapter.releaseCodeActions(cacheId)));
  }

  private nextCallId(): number {
    return this.callId++;
  }

  private createDisposable(callId: number): Disposable {
    return new Disposable(() => {
      this.adaptersMap.delete(callId);
      this.proxy.$unregister(callId);
    });
  }

  private addNewAdapter(adapter: Adapter, extension?: IExtensionDescription): number {
    const callId = this.nextCallId();
    this.adaptersMap.set(callId, adapter);
    return callId;
  }

  private withAdapter<A, R>(
    handle: number,
    constructor: ConstructorOf<A>,
    callback: (adapter: A) => Promise<R>,
    allowCancellationError = false,
  ): Promise<R> {
    const adapter = this.adaptersMap.get(handle);
    if (!(adapter instanceof constructor)) {
      return Promise.reject(new Error('no adapter found'));
    }
    const p = callback(adapter as A);

    p.catch((err) => {
      const isExpectedError = allowCancellationError && err instanceof CancellationError;
      if (!isExpectedError) {
        this.logService.error(err);
      }
    });
    return p;
  }

  private withDurationRecord(action) {
    const duration = getDurationTimer();
    return action().then((result) => ({ _dur: duration.end(), result }));
  }

  private transformDocumentSelector(selector: DocumentSelector): SerializedDocumentFilter[] {
    if (Array.isArray(selector)) {
      return selector.map((sel) => this.doTransformDocumentSelector(sel)!);
    }

    return [this.doTransformDocumentSelector(selector as DocumentFilter)!];
  }

  private doTransformDocumentSelector(selector: string | DocumentFilter): SerializedDocumentFilter | undefined {
    if (typeof selector === 'string') {
      return {
        $serialized: true,
        language: selector,
      };
    }

    if (selector) {
      return {
        $serialized: true,
        language: selector.language,
        scheme: selector.scheme,
        pattern: selector.pattern,
      };
    }

    return undefined;
  }

  async getLanguages(): Promise<string[]> {
    return this.proxy.$getLanguages();
  }

  async changeLanguage(uri: Uri, languageId: string): Promise<TextDocument> {
    await this.proxy.$changeLanguage(uri, languageId);
    const data = this.documents.getDocumentData(uri);
    if (!data) {
      throw new Error(`document '${uri.toString()}' NOT found`);
    }
    return data.document;
  }

  // ### Hover begin
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
    const callId = this.addNewAdapter(new HoverAdapter(provider, this.documents));
    this.proxy.$registerHoverProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideHover(
    handle: number,
    resource: any,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined> {
    return this.withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(resource, position, token));
  }
  $provideHoverWithDuration(
    handle: number,
    resource: any,
    position: Position,
    token: CancellationToken,
  ): Promise<WithDuration<Hover | undefined>> {
    return this.withDurationRecord(() => this.$provideHover(handle, resource, position, token));
  }
  // ### Hover end

  // ### Completion begin
  $provideCompletionItems(
    handle: number,
    resource: Uri,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
  ) {
    return this.withAdapter(handle, CompletionAdapter, (adapter) =>
      adapter.provideCompletionItems(resource, position, context, token),
    );
  }

  $resolveCompletionItem(
    handle: number,
    id: ChainedCacheId,
    token: CancellationToken,
  ): Promise<ISuggestDataDto | undefined> {
    return this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.resolveCompletionItem(id, token));
  }

  $releaseCompletionItems(handle: number, id: number): void {
    this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.releaseCompletionItems(id));
  }

  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    triggerCharacters: string[],
  ): Disposable {
    const callId = this.addNewAdapter(new CompletionAdapter(provider, this.commands.converter, this.documents));
    this.proxy.$registerCompletionSupport(
      callId,
      this.transformDocumentSelector(selector),
      triggerCharacters,
      CompletionAdapter.hasResolveSupport(provider),
    );
    return this.createDisposable(callId);
  }
  // ### Completion end

  // ### Definition provider begin
  $provideDefinition(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, DefinitionAdapter, (adapter) =>
      adapter.provideDefinition(resource, position, token),
    );
  }

  $provideDefinitionWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<WithDuration<Definition | DefinitionLink[] | undefined>> {
    return this.withDurationRecord(() => this.$provideDefinition(handle, resource, position, token));
  }

  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new DefinitionAdapter(provider, this.documents));
    this.proxy.$registerDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Definition provider end

  // ### Type Definition provider begin
  $provideTypeDefinition(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, TypeDefinitionAdapter, (adapter) =>
      adapter.provideTypeDefinition(resource, position, token),
    );
  }
  $provideTypeDefinitionWithDuration(handle: number, resource: Uri, position: Position, token: CancellationToken) {
    return this.withDurationRecord(() => this.$provideTypeDefinition(handle, resource, position, token));
  }

  registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new TypeDefinitionAdapter(provider, this.documents));
    this.proxy.$registerTypeDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Type Definition provider end

  registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable {
    const callId = this.addNewAdapter(new FoldingProviderAdapter(this.documents, provider));
    const eventHandle = typeof provider.onDidChangeFoldingRanges === 'function' ? this.nextCallId() : undefined;

    this.proxy.$registerFoldingRangeProvider(callId, this.transformDocumentSelector(selector), eventHandle);
    let result = this.createDisposable(callId);

    if (eventHandle !== undefined) {
      const subscription = provider.onDidChangeFoldingRanges!(() => this.proxy.$emitFoldingRangeEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }

    return result;
  }

  $provideFoldingRange(
    handle: number,
    resource: Uri,
    context: FoldingContext,
    token: CancellationToken,
  ): Promise<FoldingRange[] | undefined> {
    return this.withAdapter(handle, FoldingProviderAdapter, (adapter) =>
      adapter.provideFoldingRanges(resource, context, token),
    );
  }

  // ### Color Provider begin
  registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable {
    const callId = this.addNewAdapter(new ColorProviderAdapter(this.documents, provider));
    this.proxy.$registerDocumentColorProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentColors(handle: number, resource: Uri, token: CancellationToken): Promise<RawColorInfo[]> {
    return this.withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColors(resource, token));
  }

  $provideColorPresentations(
    handle: number,
    resource: Uri,
    colorInfo: RawColorInfo,
    token: CancellationToken,
  ): Promise<ColorPresentation[]> {
    return this.withAdapter(handle, ColorProviderAdapter, (adapter) =>
      adapter.provideColorPresentations(resource, colorInfo, token),
    );
  }
  // ### Color Provider end

  // ### Document Highlight Provider begin
  registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
    const callId = this.addNewAdapter(new DocumentHighlightAdapter(provider, this.documents));
    this.proxy.$registerDocumentHighlightProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentHighlights(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | undefined> {
    return this.withAdapter(handle, DocumentHighlightAdapter, (adapter) =>
      adapter.provideDocumentHighlights(resource, position, token),
    );
  }
  // ### Document Highlight Provider end

  // ### Document Formatting Provider begin
  registerDocumentFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentFormattingEditProvider,
  ): Disposable {
    const callId = this.addNewAdapter(new FormattingAdapter(provider, this.documents));
    this.proxy.$registerDocumentFormattingProvider(callId, extension, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentFormattingEdits(
    handle: number,
    resource: Uri,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, FormattingAdapter, (adapter) =>
      adapter.provideDocumentFormattingEdits(resource, options),
    );
  }
  // ### Document Formatting Provider end

  // ### Document Range Formatting Provider begin
  registerDocumentRangeFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentRangeFormattingEditProvider,
  ): Disposable {
    const callId = this.addNewAdapter(new RangeFormattingAdapter(provider, this.documents));
    this.proxy.$registerRangeFormattingProvider(callId, extension, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentRangeFormattingEdits(
    handle: number,
    resource: Uri,
    range: Range,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, RangeFormattingAdapter, (adapter) =>
      adapter.provideDocumentRangeFormattingEdits(resource, range, options),
    );
  }
  // ### Document Range Formatting Provider end

  // ### Document Type Formatting Provider begin
  registerOnTypeFormattingEditProvider(
    selector: DocumentSelector,
    provider: OnTypeFormattingEditProvider,
    triggerCharacters: string[],
  ): Disposable {
    const callId = this.addNewAdapter(new OnTypeFormattingAdapter(provider, this.documents));
    this.proxy.$registerOnTypeFormattingProvider(callId, this.transformDocumentSelector(selector), triggerCharacters);
    return this.createDisposable(callId);
  }

  $provideOnTypeFormattingEdits(
    handle: number,
    resource: Uri,
    position: Position,
    ch: string,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, OnTypeFormattingAdapter, (adapter) =>
      adapter.provideOnTypeFormattingEdits(resource, position, ch, options),
    );
  }
  $provideOnTypeFormattingEditsWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    ch: string,
    options: FormattingOptions,
  ): Promise<WithDuration<SingleEditOperation[] | undefined>> {
    return this.withDurationRecord(() => this.$provideOnTypeFormattingEdits(handle, resource, position, ch, options));
  }
  // ### Document Type Formatting Provider end

  // ### Document Code Lens Provider begin
  registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
    const callId = this.addNewAdapter(new CodeLensAdapter(provider, this.documents, this.commands.converter));
    const eventHandle = typeof provider.onDidChangeCodeLenses === 'function' ? this.nextCallId() : undefined;

    this.proxy.$registerCodeLensSupport(callId, this.transformDocumentSelector(selector), eventHandle);
    let result = this.createDisposable(callId);

    if (eventHandle !== undefined && provider.onDidChangeCodeLenses) {
      const subscription = provider.onDidChangeCodeLenses((e) => this.proxy.$emitCodeLensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }

    return result;
  }

  $provideCodeLenses(handle: number, resource: Uri, token: CancellationToken): Promise<ICodeLensListDto | undefined> {
    return this.withAdapter(handle, CodeLensAdapter, (adapter) => adapter.provideCodeLenses(resource, token));
  }

  $resolveCodeLens(handle: number, symbol: CodeLens, token: CancellationToken): Promise<CodeLens | undefined> {
    return this.withAdapter(handle, CodeLensAdapter, (adapter) => adapter.resolveCodeLens(symbol, token));
  }

  $releaseCodeLens(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(handle, CodeLensAdapter, (adapter) => Promise.resolve(adapter.releaseCodeLens(cacheId)));
  }

  // ### Document Code Lens Provider end

  // ### Code Actions Provider begin
  registerCodeActionsProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: CodeActionProvider,
    metadata?: CodeActionProviderMetadata,
  ): Disposable {
    const store = new DisposableStore();
    const callId = this.addNewAdapter(new CodeActionAdapter(provider, this.documents, this.diagnostics));
    this.proxy.$registerQuickFixProvider(
      callId,
      this.transformDocumentSelector(selector),
      {
        providedKinds: metadata?.providedCodeActionKinds?.map((kind) => kind.value),
        documentation: metadata?.documentation?.map((doc) => ({
          kind: doc.kind.value,
          command: this.commands.converter.toInternal(doc.command, store)!,
        })),
      },
      extension.displayName || extension.name,
      Boolean(provider.resolveCodeAction),
    );
    return this.createDisposable(callId);
  }

  $provideCodeActions(
    handle: number,
    resource: Uri,
    rangeOrSelection: Range | Selection,
    context: CodeActionContext,
  ): Promise<ICodeActionListDto | undefined> {
    return this.withAdapter(handle, CodeActionAdapter, (adapter) =>
      adapter.provideCodeAction(resource, rangeOrSelection, context, this.commands.converter),
    );
  }
  // ### Code Actions Provider end

  // ### Implementation provider begin
  $provideImplementation(
    handle: number,
    resource: Uri,
    position: Position,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, ImplementationAdapter, (adapter) =>
      adapter.provideImplementation(resource, position),
    );
  }
  $provideImplementationWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
  ): Promise<WithDuration<Definition | DefinitionLink[] | undefined>> {
    return this.withDurationRecord(() => this.$provideImplementation(handle, resource, position));
  }

  registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable {
    const callId = this.addNewAdapter(new ImplementationAdapter(provider, this.documents));
    this.proxy.$registerImplementationProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Implementation provider end

  // ### Declaration provider begin
  registerDeclarationProvider(selector: DocumentSelector, provider: DeclarationProvider): Disposable {
    const callId = this.addNewAdapter(new DeclarationAdapter(provider, this.documents));
    this.proxy.$registerDeclarationProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Declaration provider end

  // ### Diagnostics begin
  get onDidChangeDiagnostics() {
    return this.diagnostics.onDidChangeDiagnostics;
  }

  getDiagnostics(resource?: Uri): Diagnostic[] | [Uri, Diagnostic[]][] {
    return this.diagnostics.getDiagnostics(resource!);
  }

  createDiagnosticCollection(name?: string): DiagnosticCollection {
    return this.diagnostics.createDiagnosticCollection(name);
  }
  // ### Diagnostics end

  // ### Document Link Provider begin
  $provideDocumentLinks(handle: number, resource: Uri, token: CancellationToken): Promise<ILinksListDto | undefined> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.provideLinks(resource, token));
  }

  $resolveDocumentLink(handle: number, id: ChainedCacheId, token: CancellationToken): Promise<ILink | undefined> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.resolveLink(id, token));
  }

  $releaseDocumentLinks(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => Promise.resolve(adapter.releaseLink(cacheId)));
  }

  registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable {
    const callId = this.addNewAdapter(new LinkProviderAdapter(provider, this.documents));
    this.proxy.$registerDocumentLinkProvider(
      callId,
      this.transformDocumentSelector(selector),
      typeof provider.resolveDocumentLink === 'function',
    );
    return this.createDisposable(callId);
  }
  // ### Document Link Provider end

  // ### Code Reference Provider begin
  $provideReferences(
    handle: number,
    resource: Uri,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[] | undefined> {
    return this.withAdapter(handle, ReferenceAdapter, (adapter) =>
      adapter.provideReferences(resource, position, context, token),
    );
  }

  $provideReferencesWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<WithDuration<Location[] | undefined>> {
    return this.withDurationRecord(() => this.$provideReferences(handle, resource, position, context, token));
  }

  registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable {
    const callId = this.addNewAdapter(new ReferenceAdapter(provider, this.documents));
    this.proxy.$registerReferenceProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Code Reference Provider end

  setLanguageConfiguration(language: string, configuration: LanguageConfiguration): Disposable {
    const { wordPattern } = configuration;

    if (wordPattern) {
      this.documents.setWordDefinitionFor(language, wordPattern);
    } else {
      this.documents.setWordDefinitionFor(language, undefined);
    }

    const callId = this.nextCallId();

    const config: SerializedLanguageConfiguration = {
      brackets: configuration.brackets,
      comments: configuration.comments,
      onEnterRules: serializeEnterRules(configuration.onEnterRules),
      wordPattern: serializeRegExp(configuration.wordPattern),
      indentationRules: serializeIndentation(configuration.indentationRules),
    };
    this.proxy.$setLanguageConfiguration(callId, language, config);
    return this.createDisposable(callId);
  }

  // ### Document Symbol Provider begin
  registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider): Disposable {
    const callId = this.addNewAdapter(new OutlineAdapter(this.documents, provider));
    this.proxy.$registerOutlineSupport(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentSymbols(
    handle: number,
    resource: Uri,
    token: CancellationToken,
  ): Promise<DocumentSymbol[] | undefined> {
    return this.withAdapter(handle, OutlineAdapter, (adapter) => adapter.provideDocumentSymbols(resource, token));
  }
  // ### Document Symbol Provider end

  // ### WorkspaceSymbol Provider begin
  registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider): Disposable {
    const callId = this.addNewAdapter(new WorkspaceSymbolAdapter(provider));
    this.proxy.$registerWorkspaceSymbolProvider(callId);
    return this.createDisposable(callId);
  }

  $provideWorkspaceSymbols(handle: number, query: string, token: CancellationToken): PromiseLike<SymbolInformation[]> {
    return this.withAdapter(handle, WorkspaceSymbolAdapter, (adapter) => adapter.provideWorkspaceSymbols(query, token));
  }

  $resolveWorkspaceSymbol(
    handle: number,
    symbol: SymbolInformation,
    token: CancellationToken,
  ): PromiseLike<SymbolInformation> {
    return this.withAdapter(handle, WorkspaceSymbolAdapter, (adapter) => adapter.resolveWorkspaceSymbol(symbol, token));
  }
  // ### WorkspaceSymbol Provider end
  // ### Signature help begin
  $provideSignatureHelp(
    handle: number,
    resource: Uri,
    position: Position,
    context: SignatureHelpContextDto,
    token: CancellationToken,
  ): Promise<ISignatureHelpDto | undefined> {
    return this.withAdapter(handle, SignatureHelpAdapter, (adapter) =>
      adapter.provideSignatureHelp(resource, position, token, context),
    );
  }

  $releaseSignatureHelp(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(handle, SignatureHelpAdapter, (adapter) =>
      Promise.resolve(adapter.releaseSignatureHelp(cacheId)),
    );
  }

  registerSignatureHelpProvider(
    selector: DocumentSelector,
    provider: SignatureHelpProvider,
    metadataOrTriggerChars: string[] | SignatureHelpProviderMetadata,
  ): Disposable {
    const metadata: ISerializedSignatureHelpProviderMetadata | undefined = Array.isArray(metadataOrTriggerChars)
      ? { triggerCharacters: metadataOrTriggerChars, retriggerCharacters: [] }
      : metadataOrTriggerChars;
    const callId = this.addNewAdapter(new SignatureHelpAdapter(provider, this.documents));
    this.proxy.$registerSignatureHelpProvider(callId, this.transformDocumentSelector(selector), metadata);
    return this.createDisposable(callId);
  }

  // ### Signature help end
  // ### Rename Provider begin
  registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable {
    const callId = this.addNewAdapter(new RenameAdapter(provider, this.documents));
    this.proxy.$registerRenameProvider(
      callId,
      this.transformDocumentSelector(selector),
      RenameAdapter.supportsResolving(provider),
    );
    return this.createDisposable(callId);
  }

  $provideRenameEdits(
    handle: number,
    resource: Uri,
    position: Position,
    newName: string,
    token: CancellationToken,
  ): Promise<WorkspaceEditDto | undefined> {
    return this.withAdapter(handle, RenameAdapter, (adapter) =>
      adapter.provideRenameEdits(resource, position, newName, token),
    );
  }

  $resolveRenameLocation(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<RenameLocation | undefined> {
    return this.withAdapter(handle, RenameAdapter, (adapter) =>
      adapter.resolveRenameLocation(resource, position, token),
    );
  }
  // ### Rename Provider end

  // ### smart select
  registerSelectionRangeProvider(selector: DocumentSelector, provider: SelectionRangeProvider): Disposable {
    const callId = this.addNewAdapter(new SelectionRangeAdapter(this.documents, provider));
    this.proxy.$registerSelectionRangeProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideSelectionRanges(
    handle: number,
    resource: Uri,
    positions: Position[],
    token: CancellationToken,
  ): Promise<SelectionRange[][]> {
    return this.withAdapter(handle, SelectionRangeAdapter, (adapter) =>
      adapter.provideSelectionRanges(resource, positions, token),
    );
  }

  registerCallHierarchyProvider(selector: DocumentSelector, provider: CallHierarchyProvider): Disposable {
    const callId = this.addNewAdapter(new CallHierarchyAdapter(this.documents, provider));
    this.proxy.$registerCallHierarchyProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $prepareCallHierarchy(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ICallHierarchyItemDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) =>
      Promise.resolve(adapter.prepareSession(Uri.revive(resource), position, token)),
    );
  }

  $provideCallHierarchyIncomingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IIncomingCallDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) =>
      adapter.provideCallsTo(sessionId, itemId, token),
    );
  }

  $provideCallHierarchyOutgoingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IOutgoingCallDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) =>
      adapter.provideCallsFrom(sessionId, itemId, token),
    );
  }

  $releaseCallHierarchy(handle: number, sessionId: string): void {
    this.withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)));
  }

  // #region Semantic Tokens
  registerDocumentSemanticTokensProvider(
    selector: DocumentSelector,
    provider: DocumentSemanticTokensProvider,
    legend: SemanticTokensLegend,
  ): Disposable {
    const callId = this.addNewAdapter(new DocumentSemanticTokensAdapter(this.documents, provider));
    this.proxy.$registerDocumentSemanticTokensProvider(callId, this.transformDocumentSelector(selector), legend);
    return this.createDisposable(callId);
  }

  $provideDocumentSemanticTokens(
    handle: number,
    resource: Uri,
    previousResultId: number,
    token: CancellationToken,
  ): Promise<Uint8Array | null> {
    return this.withAdapter(
      handle,
      DocumentSemanticTokensAdapter,
      (adapter) => adapter.provideDocumentSemanticTokens(Uri.revive(resource), previousResultId, token),
      true,
    );
  }

  $releaseDocumentSemanticTokens(handle: number, semanticColoringResultId: number): void {
    this.withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) =>
      adapter.releaseDocumentSemanticColoring(semanticColoringResultId),
    );
  }

  registerDocumentRangeSemanticTokensProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentRangeSemanticTokensProvider,
    legend: SemanticTokensLegend,
  ): Disposable {
    const callId = this.addNewAdapter(new DocumentRangeSemanticTokensAdapter(this.documents, provider), extension);
    this.proxy.$registerDocumentRangeSemanticTokensProvider(callId, this.transformDocumentSelector(selector), legend);
    return this.createDisposable(callId);
  }

  $provideDocumentRangeSemanticTokens(
    handle: number,
    resource: Uri,
    range: Range,
    token: CancellationToken,
  ): Promise<Uint8Array | null> {
    return this.withAdapter(handle, DocumentRangeSemanticTokensAdapter, (adapter) =>
      adapter.provideDocumentRangeSemanticTokens(Uri.revive(resource), range, token),
    );
  }

  // #endregion

  // #region EvaluatableExpression
  registerEvaluatableExpressionProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: EvaluatableExpressionProvider,
  ): Disposable {
    const callId = this.addNewAdapter(new EvaluatableExpressionAdapter(this.documents, provider), extension);
    this.proxy.$registerEvaluatableExpressionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideEvaluatableExpression(handle: number, resource: Uri, position: Position, token: CancellationToken) {
    return this.withAdapter(handle, EvaluatableExpressionAdapter, (adapter) =>
      adapter.provideEvaluatableExpression(Uri.revive(resource), position, token),
    );
  }
  // #endregion EvaluatableExpression

  // #region Inline Values
  registerInlineValuesProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: InlineValuesProvider,
  ): Disposable {
    const eventHandle = typeof provider.onDidChangeInlineValues === 'function' ? this.nextCallId() : undefined;
    const handle = this.addNewAdapter(new InlineValuesAdapter(this.documents, provider), extension);

    this.proxy.$registerInlineValuesProvider(handle, this.transformDocumentSelector(selector), eventHandle);
    let result = this.createDisposable(handle);

    if (eventHandle !== undefined) {
      const subscription = provider.onDidChangeInlineValues!((_) => this.proxy.$emitInlineValuesEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }

  $provideInlineValues(
    handle: number,
    resource: Uri,
    range: Range,
    context: IInlineValueContextDto,
    token: CancellationToken,
  ): Promise<InlineValue[] | undefined> {
    return this.withAdapter(
      handle,
      InlineValuesAdapter,
      (adapter) => adapter.provideInlineValues(Uri.revive(resource), range, context, token),
      undefined,
    );
  }
  // #endregion Inline Values

  // #region Linked Editing
  registerLinkedEditingRangeProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: LinkedEditingRangeProvider,
  ): Disposable {
    const handle = this.addNewAdapter(new LinkedEditingRangeAdapter(this.documents, provider), extension);
    this.proxy.$registerLinkedEditingRangeProvider(handle, this.transformDocumentSelector(selector));
    return this.createDisposable(handle);
  }

  $provideLinkedEditingRanges(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ILinkedEditingRangesDto | undefined> {
    return this.withAdapter(
      handle,
      LinkedEditingRangeAdapter,
      async (adapter) => {
        const res = await adapter.provideLinkedEditingRanges(Uri.revive(resource), position, token);
        if (res) {
          return {
            ranges: res.ranges,
            wordPattern: res.wordPattern ? serializeRegExp(res.wordPattern) : undefined,
          };
        }
        return undefined;
      },
      undefined,
    );
  }

  // #endregion Linked Editing

  // --- inline hints

  registerInlayHintsProvider(
    extension: IExtensionDescription,
    selector: vscode.DocumentSelector,
    provider: vscode.InlayHintsProvider,
  ): Disposable {
    const eventHandle = typeof provider.onDidChangeInlayHints === 'function' ? this.nextCallId() : undefined;
    const handle = this.addNewAdapter(new InlayHintsAdapter(this.documents, provider), extension);

    this.proxy.$registerInlayHintsProvider(handle, this.transformDocumentSelector(selector), eventHandle);
    let result = this.createDisposable(handle);

    if (eventHandle !== undefined) {
      const subscription = provider.onDidChangeInlayHints!(() => this.proxy.$emitInlayHintsEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }

  $provideInlayHints(handle: number, resource: UriComponents, range: Range, token: CancellationToken) {
    return this.withAdapter(
      handle,
      InlayHintsAdapter,
      (adapter) => adapter.provideInlayHints(Uri.revive(resource), range, token),
      undefined,
    );
  }

  private _handlePool = 0;
  private _ids = new Set<string>();

  createLanguageStatusItem(
    extension: IExtensionDescription,
    id: string,
    selector: vscode.DocumentSelector,
  ): vscode.LanguageStatusItem {
    const handle = this._handlePool++;
    const proxy = this.proxy;
    const ids = this._ids;

    // enforce extension unique identifier
    const fullyQualifiedId = `${extension.identifier.value}/${id}`;
    if (ids.has(fullyQualifiedId)) {
      throw new Error(`LanguageStatusItem with id '${id}' ALREADY exists`);
    }
    ids.add(fullyQualifiedId);

    const data: Omit<vscode.LanguageStatusItem, 'dispose'> = {
      selector,
      id,
      name: extension.displayName ?? extension.name,
      severity: LanguageStatusSeverity.Information,
      command: undefined,
      text: '',
      detail: '',
    };

    let soonHandle: IDisposable | undefined;
    const commandDisposables = new DisposableStore();
    const updateAsync = () => {
      soonHandle?.dispose();
      soonHandle = disposableTimeout(() => {
        commandDisposables.clear();
        this.proxy.$setLanguageStatus(handle, {
          id: fullyQualifiedId,
          name: data.name ?? extension.displayName ?? extension.name,
          source: extension.displayName ?? extension.name,
          // TODO：缺少 uriTransformer，先不传递
          // selector: typeConvert.DocumentSelector.from(data.selector, this._uriTransformer),
          selector: typeConvert.DocumentSelector.from(data.selector),
          label: data.text,
          detail: data.detail ?? '',
          severity:
            data.severity === LanguageStatusSeverity.Error
              ? Severity.Error
              : data.severity === LanguageStatusSeverity.Warning
              ? Severity.Warning
              : Severity.Info,
          command: data.command && this.commands.converter.toInternal(data.command, commandDisposables),
          accessibilityInfo: data.accessibilityInformation,
        });
      }, 0);
    };

    const result: vscode.LanguageStatusItem = {
      dispose() {
        commandDisposables.dispose();
        soonHandle?.dispose();
        proxy.$removeLanguageStatus(handle);
        ids.delete(fullyQualifiedId);
      },
      get id() {
        return data.id;
      },
      get name() {
        return data.name;
      },
      set name(value) {
        data.name = value;
        updateAsync();
      },
      get selector() {
        return data.selector;
      },
      set selector(value) {
        data.selector = value;
        updateAsync();
      },
      get text() {
        return data.text;
      },
      set text(value) {
        data.text = value;
        updateAsync();
      },
      get detail() {
        return data.detail;
      },
      set detail(value) {
        data.detail = value;
        updateAsync();
      },
      get severity() {
        return data.severity;
      },
      set severity(value) {
        data.severity = value;
        updateAsync();
      },
      get accessibilityInformation() {
        return data.accessibilityInformation;
      },
      set accessibilityInformation(value) {
        data.accessibilityInformation = value;
        updateAsync();
      },
      get command() {
        return data.command;
      },
      set command(value) {
        data.command = value;
        updateAsync();
      },
    };
    updateAsync();
    return result;
  }
}
