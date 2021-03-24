import type { CodeActionContext, CodeActionList } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { ConstructorOf } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { fromLanguageSelector } from '../../../common/vscode/converter';
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
  SignatureHelpContext,
  Event,
  DiagnosticChangeEvent,
  SelectionRangeProvider,
  DocumentFormattingEditProvider,
  CallHierarchyProvider,
  DocumentSemanticTokensProvider,
  SemanticTokensLegend,
  DocumentRangeSemanticTokensProvider,
  EvaluatableExpressionProvider,
} from 'vscode';
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
  CodeLensList,
  CodeLens,
  DocumentLink,
  ReferenceContext,
  Location,
  SerializedLanguageConfiguration,
  ILink,
  DocumentSymbol,
  SignatureHelpResult,
  WorkspaceEditDto,
  RenameLocation,
  ISerializedSignatureHelpProviderMetadata,
  SignatureHelpContextDto,
  SelectionRange,
  CompletionItem,
  ICallHierarchyItemDto,
  IIncomingCallDto,
  IOutgoingCallDto,
} from '../../../common/vscode/model.api';
import {
  IMainThreadLanguages,
  MainThreadAPIIdentifier,
  ExtensionDocumentDataManager,
  IExtHostLanguages,
} from '../../../common/vscode';
import { SymbolInformation } from 'vscode-languageserver-types';
import { UriComponents } from 'vscode-uri';
import { Uri } from '@ali/ide-core-common';
import { Disposable } from '../../../common/vscode/ext-types';
import { CompletionAdapter } from './language/completion';
import { DefinitionAdapter } from './language/definition';
import { DeclarationAdapter } from './language/declaration';
import { TypeDefinitionAdapter } from './language/type-definition';
import { FoldingProviderAdapter } from './language/folding';
import { ColorProviderAdapter } from './language/color';
import { DocumentHighlightAdapter } from './language/document-highlight';
import { HoverAdapter } from './language/hover';
import { CodeLensAdapter } from './language/lens';
import { RangeFormattingAdapter, FormattingAdapter } from './language/range-formatting';
import { OnTypeFormattingAdapter } from './language/on-type-formatting';
import { CodeActionAdapter } from './language/code-action';
import { Diagnostics } from './language/diagnostics';
import { ImplementationAdapter } from './language/implementation';
import { LinkProviderAdapter } from './language/link-provider';
import { ReferenceAdapter } from './language/reference';
import { score } from './language/util';
import { serializeEnterRules, serializeRegExp, serializeIndentation } from '../../../common/vscode/utils';
import { OutlineAdapter } from './language/outline';
import { WorkspaceSymbolAdapter } from './language/workspace-symbol';
import { SignatureHelpAdapter } from './language/signature';
import { RenameAdapter } from './language/rename';
import { SelectionRangeAdapter } from './language/selection';
import { CallHierarchyAdapter } from './language/callhierarchy';
import { ExtHostCommands } from './ext.host.command';
import { IExtension } from '../../../common';
import { DocumentRangeSemanticTokensAdapter, DocumentSemanticTokensAdapter } from './language/semantic-tokens';
import { EvaluatableExpressionAdapter } from './language/evaluatableExpression';

export function createLanguagesApiFactory(extHostLanguages: ExtHostLanguages, extension: IExtension) {

  return {
    getLanguages(): Promise<string[]> {
      return extHostLanguages.getLanguages();
    },
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider);
    },
    registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable {
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
      return score(fromLanguageSelector(selector), document.uri, document.languageId, true);
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
    registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable {
      return extHostLanguages.registerCodeActionsProvider(selector, provider, metadata);
    },
    registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable {
      return extHostLanguages.registerRenameProvider(selector, provider);
    },
    registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, firstItem?: string | SignatureHelpProviderMetadata, ...remaining: string[]) {
      if (typeof firstItem === 'object') {
        return extHostLanguages.registerSignatureHelpProvider(selector, provider, firstItem);
      }
      return extHostLanguages.registerSignatureHelpProvider(selector, provider, typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining]);
    },
    registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
      return extHostLanguages.registerCodeLensProvider(selector, provider);
    },
    registerOnTypeFormattingEditProvider(selector: DocumentSelector, provider: OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacter: string[]): Disposable {
      return extHostLanguages.registerOnTypeFormattingEditProvider(selector, provider, [firstTriggerCharacter].concat(moreTriggerCharacter));
    },
    registerDocumentRangeFormattingEditProvider(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable {
      return extHostLanguages.registerDocumentRangeFormattingEditProvider(extension.id, selector,  provider);
    },
    registerDocumentFormattingEditProvider(selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable {
      return extHostLanguages.registerDocumentFormattingEditProvider(extension.id, selector, provider);
    },
    registerSelectionRangeProvider(selector: DocumentSelector, provider: SelectionRangeProvider): Disposable {
      return extHostLanguages.registerSelectionRangeProvider(selector, provider);
    },
    registerCallHierarchyProvider(selector: DocumentSelector, provider: CallHierarchyProvider): Disposable {
      return extHostLanguages.registerCallHierarchyProvider(selector, provider);
    },
    registerDocumentSemanticTokensProvider(selector: DocumentSelector, provider: DocumentSemanticTokensProvider, legend: SemanticTokensLegend): Disposable {
      return extHostLanguages.registerDocumentSemanticTokensProvider(selector, provider, legend);
    },
    registerDocumentRangeSemanticTokensProvider(selector: DocumentSelector, provider: DocumentRangeSemanticTokensProvider, legend: SemanticTokensLegend): Disposable {
      return extHostLanguages.registerDocumentRangeSemanticTokensProvider(extension, selector, provider, legend);
    },
    registerEvaluatableExpressionProvider(selector: DocumentSelector, provider: EvaluatableExpressionProvider): Disposable {
      return extHostLanguages.registerEvaluatableExpressionProvider(extension, selector, provider);
    },
  };
}

export type Adapter =
  HoverAdapter |
  CompletionAdapter |
  DefinitionAdapter |
  TypeDefinitionAdapter |
  FoldingProviderAdapter |
  ColorProviderAdapter |
  DocumentHighlightAdapter |
  RangeFormattingAdapter |
  CodeLensAdapter |
  OnTypeFormattingAdapter |
  CodeActionAdapter |
  ImplementationAdapter |
  LinkProviderAdapter |
  OutlineAdapter |
  WorkspaceSymbolAdapter |
  ReferenceAdapter |
  SignatureHelpAdapter |
  SelectionRangeAdapter |
  FormattingAdapter |
  RenameAdapter |
  DeclarationAdapter |
  CallHierarchyAdapter |
  DocumentSemanticTokensAdapter |
  DocumentRangeSemanticTokensAdapter |
  EvaluatableExpressionAdapter;

export class ExtHostLanguages implements IExtHostLanguages {
  private readonly proxy: IMainThreadLanguages;
  private readonly rpcProtocol: IRPCProtocol;
  private callId = 0;
  private adaptersMap = new Map<number, Adapter>();
  private diagnostics: Diagnostics;

  constructor(rpcProtocol: IRPCProtocol, private documents: ExtensionDocumentDataManager, private commands: ExtHostCommands) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadLanguages);
    this.diagnostics = new Diagnostics(this.proxy);
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

  private addNewAdapter(adapter: Adapter, extension?: IExtension): number {
    const callId = this.nextCallId();
    this.adaptersMap.set(callId, adapter);
    return callId;
  }

  // tslint:disable-next-line:no-any
  private withAdapter<A, R>(handle: number, constructor: ConstructorOf<A>, callback: (adapter: A) => Promise<R>): Promise<R> {
    const adapter = this.adaptersMap.get(handle);
    if (!(adapter instanceof constructor)) {
      return Promise.reject(new Error('no adapter found'));
    }
    return callback(adapter as A);
  }

  private transformDocumentSelector(selector: DocumentSelector): SerializedDocumentFilter[] {
    if (Array.isArray(selector)) {
      return selector.map((sel) => this.doTransformDocumentSelector(sel)!);
    }

    return [this.doTransformDocumentSelector(selector)!];
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

  $provideHover(handle: number, resource: any, position: Position, token: CancellationToken): Promise<Hover | undefined> {
    return this.withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(resource, position, token));
  }
  // ### Hover end

  // ### Completion begin
  $provideCompletionItems(handle: number, resource: Uri, position: Position, context: CompletionContext, token: CancellationToken) {
    return this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.provideCompletionItems(resource, position, context, token));
  }

  $resolveCompletionItem(handle: number, resource: Uri, position: Position, completion: CompletionItem, token: CancellationToken): Promise<CompletionItem> {
    return this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.resolveCompletionItem(resource, position, completion, token));
  }

  $releaseCompletionItems(handle: number, id: number): void {
    this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.releaseCompletionItems(id));
  }

  registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, triggerCharacters: string[]): Disposable {
    const callId = this.addNewAdapter(new CompletionAdapter(provider, this.commands.converter, this.documents));
    this.proxy.$registerCompletionSupport(callId, this.transformDocumentSelector(selector), triggerCharacters, CompletionAdapter.hasResolveSupport(provider));
    return this.createDisposable(callId);
  }
  // ### Completion end

  // ### Definition provider begin
  $provideDefinition(handle: number, resource: Uri, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, DefinitionAdapter, (adapter) => adapter.provideDefinition(resource, position, token));
  }

  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new DefinitionAdapter(provider, this.documents));
    this.proxy.$registerDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Definition provider end

  // ### Type Definition provider begin
  $provideTypeDefinition(handle: number, resource: Uri, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, TypeDefinitionAdapter, (adapter) => adapter.provideTypeDefinition(resource, position, token));
  }

  registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new TypeDefinitionAdapter(provider, this.documents));
    this.proxy.$registerTypeDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Type Definition provider end

  registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable {
    const callId = this.addNewAdapter(new FoldingProviderAdapter(this.documents, provider));
    this.proxy.$registerFoldingRangeProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideFoldingRange(handle: number, resource: Uri, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[] | undefined> {
    return this.withAdapter(handle, FoldingProviderAdapter, (adapter) => adapter.provideFoldingRanges(resource, context, token));
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

  $provideColorPresentations(handle: number, resource: Uri, colorInfo: RawColorInfo, token: CancellationToken): Promise<ColorPresentation[]> {
    return this.withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColorPresentations(resource, colorInfo, token));
  }
  // ### Color Provider end

  // ### Document Highlight Provider begin
  registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
    const callId = this.addNewAdapter(new DocumentHighlightAdapter(provider, this.documents));
    this.proxy.$registerDocumentHighlightProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentHighlights(handle: number, resource: Uri, position: Position, token: CancellationToken): Promise<DocumentHighlight[] | undefined> {
    return this.withAdapter(handle, DocumentHighlightAdapter, (adapter) => adapter.provideDocumentHighlights(resource, position, token));
  }
  // ### Document Highlight Provider end

  // ### Document Formatting Provider begin
  registerDocumentFormattingEditProvider(displayName: string, selector: DocumentSelector, provider: DocumentFormattingEditProvider): Disposable {
    const callId = this.addNewAdapter(new FormattingAdapter(provider, this.documents));
    this.proxy.$registerDocumentFormattingProvider(callId, displayName, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentFormattingEdits(handle: number, resource: Uri, options: FormattingOptions): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, FormattingAdapter, (adapter) => adapter.provideDocumentFormattingEdits(resource, options));
  }
  // ### Document Formatting Provider end

  // ### Document Range Formatting Provider begin
  registerDocumentRangeFormattingEditProvider(displayName: string, selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable {
    const callId = this.addNewAdapter(new RangeFormattingAdapter(provider, this.documents));
    this.proxy.$registerRangeFormattingProvider(callId, displayName, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentRangeFormattingEdits(handle: number, resource: Uri, range: Range, options: FormattingOptions): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, RangeFormattingAdapter, (adapter) => adapter.provideDocumentRangeFormattingEdits(resource, range, options));
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

  $provideOnTypeFormattingEdits(handle: number, resource: Uri, position: Position, ch: string, options: FormattingOptions): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(handle, OnTypeFormattingAdapter, (adapter) => adapter.provideOnTypeFormattingEdits(resource, position, ch, options));
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

  $provideCodeLenses(handle: number, resource: Uri): Promise<CodeLensList | undefined> {
    return this.withAdapter(handle, CodeLensAdapter, (adapter) => adapter.provideCodeLenses(resource));
  }

  $resolveCodeLens(handle: number, resource: Uri, symbol: CodeLens): Promise<CodeLens | undefined> {
    return this.withAdapter(handle, CodeLensAdapter, (adapter) => adapter.resolveCodeLens(resource, symbol));
  }
  // ### Document Code Lens Provider end

  // ### Code Actions Provider begin
  registerCodeActionsProvider(
    selector: DocumentSelector,
    provider: CodeActionProvider,
    metadata?: CodeActionProviderMetadata,
  ): Disposable {
    const callId = this.addNewAdapter(new CodeActionAdapter(provider, this.documents, this.diagnostics));
    this.proxy.$registerQuickFixProvider(
      callId,
      this.transformDocumentSelector(selector),
      metadata && metadata.providedCodeActionKinds ? metadata.providedCodeActionKinds.map((kind) => kind.value!) : undefined,
    );
    return this.createDisposable(callId);
  }

  $provideCodeActions(handle: number, resource: Uri, rangeOrSelection: Range | Selection, context: CodeActionContext): Promise<CodeActionList| undefined> {
    return this.withAdapter(handle, CodeActionAdapter, (adapter) => adapter.provideCodeAction(resource, rangeOrSelection, context, this.commands.converter));
  }
  // ### Code Actions Provider end

  // ### Implementation provider begin
  $provideImplementation(handle: number, resource: Uri, position: Position): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, ImplementationAdapter, (adapter) => adapter.provideImplementation(resource, position));
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
  $provideDocumentLinks(handle: number, resource: Uri, token: CancellationToken): Promise<ILink[] | undefined> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.provideLinks(resource, token));
  }

  $resolveDocumentLink(handle: number, link: DocumentLink, token: CancellationToken): Promise<ILink | undefined> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.resolveLink(link, token));
  }

  registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable {
    const callId = this.addNewAdapter(new LinkProviderAdapter(provider, this.documents));
    this.proxy.$registerDocumentLinkProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Document Link Provider end

  // ### Code Reference Provider begin
  $provideReferences(handle: number, resource: Uri, position: Position, context: ReferenceContext, token: CancellationToken): Promise<Location[] | undefined> {
    return this.withAdapter(handle, ReferenceAdapter, (adapter) => adapter.provideReferences(resource, position, context, token));
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

  $provideDocumentSymbols(handle: number, resource: Uri, token: CancellationToken): Promise<DocumentSymbol[] | undefined> {
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

  $resolveWorkspaceSymbol(handle: number, symbol: SymbolInformation, token: CancellationToken): PromiseLike<SymbolInformation> {
    return this.withAdapter(handle, WorkspaceSymbolAdapter, (adapter) => adapter.resolveWorkspaceSymbol(symbol, token));
  }
  // ### WorkspaceSymbol Provider end
  // ### Signature help begin
  $provideSignatureHelp(handle: number, resource: Uri, position: Position, context: SignatureHelpContextDto, token: CancellationToken): Promise<SignatureHelpResult | undefined | null> {
    return this.withAdapter(handle, SignatureHelpAdapter, (adapter) => adapter.provideSignatureHelp(resource, position, token, context as SignatureHelpContext));
  }

  registerSignatureHelpProvider(selector: DocumentSelector, provider: SignatureHelpProvider, metadataOrTriggerChars: string[] | SignatureHelpProviderMetadata): Disposable {
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
    this.proxy.$registerRenameProvider(callId, this.transformDocumentSelector(selector), RenameAdapter.supportsResolving(provider));
    return this.createDisposable(callId);
  }

  $provideRenameEdits(handle: number, resource: Uri, position: Position, newName: string, token: CancellationToken): Promise<WorkspaceEditDto | undefined> {
    return this.withAdapter(handle, RenameAdapter, (adapter) => adapter.provideRenameEdits(resource, position, newName, token));
  }

  $resolveRenameLocation(handle: number, resource: Uri, position: Position, token: CancellationToken): Promise<RenameLocation | undefined> {
    return this.withAdapter(handle, RenameAdapter, (adapter) => adapter.resolveRenameLocation(resource, position, token));
  }
  // ### Rename Provider end

  // ### smart select
  registerSelectionRangeProvider(selector: DocumentSelector, provider: SelectionRangeProvider): Disposable {
    const callId = this.addNewAdapter(new SelectionRangeAdapter(this.documents, provider));
    this.proxy.$registerSelectionRangeProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideSelectionRanges(handle: number, resource: Uri, positions: Position[], token: CancellationToken): Promise<SelectionRange[][]> {
    return this.withAdapter(handle, SelectionRangeAdapter, (adapter) => adapter.provideSelectionRanges(resource, positions, token));
  }

  registerCallHierarchyProvider(selector: DocumentSelector, provider: CallHierarchyProvider): Disposable {
    const callId = this.addNewAdapter(new CallHierarchyAdapter(this.documents, provider));
    this.proxy.$registerCallHierarchyProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $prepareCallHierarchy(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<ICallHierarchyItemDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.prepareSession(Uri.revive(resource), position, token)));
  }

  $provideCallHierarchyIncomingCalls(handle: number, sessionId: string, itemId: string, token: CancellationToken): Promise<IIncomingCallDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsTo(sessionId, itemId, token));
  }

  $provideCallHierarchyOutgoingCalls(handle: number, sessionId: string, itemId: string, token: CancellationToken): Promise<IOutgoingCallDto[] | undefined> {
    return this.withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsFrom(sessionId, itemId, token));
  }

  $releaseCallHierarchy(handle: number, sessionId: string): void {
    this.withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)));
  }

  //#region Semantic Tokens
  registerDocumentSemanticTokensProvider(selector: DocumentSelector, provider: DocumentSemanticTokensProvider, legend: SemanticTokensLegend): Disposable {
    const callId = this.addNewAdapter(new DocumentSemanticTokensAdapter(this.documents, provider));
    this.proxy.$registerDocumentSemanticTokensProvider(callId, this.transformDocumentSelector(selector), legend);
    return this.createDisposable(callId);
  }

  $provideDocumentSemanticTokens(handle: number, resource: Uri, previousResultId: number, token: CancellationToken): Promise<Uint8Array | null> {
    return this.withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.provideDocumentSemanticTokens(Uri.revive(resource), previousResultId, token));
  }

  $releaseDocumentSemanticTokens(handle: number, semanticColoringResultId: number): void {
    this.withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.releaseDocumentSemanticColoring(semanticColoringResultId));
  }

  registerDocumentRangeSemanticTokensProvider(extension: IExtension, selector: DocumentSelector, provider: DocumentRangeSemanticTokensProvider, legend: SemanticTokensLegend): Disposable {
    const callId = this.addNewAdapter(new DocumentRangeSemanticTokensAdapter(this.documents, provider), extension);
    this.proxy.$registerDocumentRangeSemanticTokensProvider(callId, this.transformDocumentSelector(selector), legend);
    return this.createDisposable(callId);
  }

  $provideDocumentRangeSemanticTokens(handle: number, resource: Uri, range: Range, token: CancellationToken): Promise<Uint8Array | null> {
    return this.withAdapter(handle, DocumentRangeSemanticTokensAdapter, (adapter) => adapter.provideDocumentRangeSemanticTokens(Uri.revive(resource), range, token));
  }

  //#endregion

  //#region EvaluatableExpression
  registerEvaluatableExpressionProvider(extension: IExtension, selector: DocumentSelector, provider: EvaluatableExpressionProvider): Disposable {
    const callId = this.addNewAdapter(new EvaluatableExpressionAdapter(this.documents, provider), extension);
    this.proxy.$registerEvaluatableExpressionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideEvaluatableExpression(handle: number, resource: Uri, position: Position, token: CancellationToken) {
    return this.withAdapter(handle, EvaluatableExpressionAdapter, (adapter) => adapter.provideEvaluatableExpression(Uri.revive(resource), position, token));
  }
  //#endregion EvaluatableExpression
}
