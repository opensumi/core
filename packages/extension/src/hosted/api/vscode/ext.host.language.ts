/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// some code copied and modified from https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostLanguageFeatures.ts
import vscode, {
  CallHierarchyProvider,
  CancellationToken,
  CodeActionProvider,
  CodeActionProviderMetadata,
  CodeLensProvider,
  CompletionItemProvider,
  DeclarationProvider,
  DefinitionProvider,
  Diagnostic,
  DiagnosticChangeEvent,
  DiagnosticCollection,
  DocumentColorProvider,
  DocumentFilter,
  DocumentFormattingEditProvider,
  DocumentHighlightProvider,
  DocumentLinkProvider,
  DocumentRangeFormattingEditProvider,
  DocumentRangeSemanticTokensProvider,
  DocumentSelector,
  DocumentSemanticTokensProvider,
  DocumentSymbolProvider,
  EvaluatableExpressionProvider,
  Event,
  FoldingContext,
  FoldingRangeProvider,
  HoverProvider,
  ImplementationProvider,
  InlineValuesProvider,
  LanguageConfiguration,
  LinkedEditingRangeProvider,
  NewSymbolName,
  NewSymbolNamesProvider,
  OnTypeFormattingEditProvider,
  ReferenceProvider,
  RenameProvider,
  SelectionRangeProvider,
  SemanticTokensLegend,
  SignatureHelpProvider,
  SignatureHelpProviderMetadata,
  TextDocument,
  TypeDefinitionProvider,
  TypeHierarchyProvider,
  WorkspaceSymbolProvider,
  // eslint-disable-next-line import/no-unresolved
} from 'vscode';
import { SymbolInformation } from 'vscode-languageserver-types';

import { ConstructorOf } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  DisposableStore,
  IDisposable,
  IExtensionLogger,
  Severity,
  Uri,
  UriComponents,
  disposableTimeout,
  toDisposable,
} from '@opensumi/ide-core-common';
import { InlineValue } from '@opensumi/ide-debug/lib/common/inline-values';
import { IPosition } from '@opensumi/ide-monaco/lib/common';

import {
  ExtensionDocumentDataManager,
  ExtensionIdentifier,
  ExtensionNotebookDocumentManager,
  ICodeActionListDto,
  IExtHostLanguages,
  IExtensionDescription,
  IInlayHintDto,
  IInlayHintsDto,
  IInlineValueContextDto,
  ILinkedEditingRangesDto,
  IMainThreadLanguages,
  ISuggestDataDto,
  IdentifiableInlineCompletions,
  InlineCompletionContext,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import * as typeConvert from '../../../common/vscode/converter';
import { CancellationError, Disposable, LanguageStatusSeverity } from '../../../common/vscode/ext-types';
import {
  ChainedCacheId,
  CodeLens,
  ColorPresentation,
  CompletionContext,
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
  Location,
  Position,
  Range,
  RawColorInfo,
  ReferenceContext,
  RenameLocation,
  Selection,
  SelectionRange,
  SerializedDocumentFilter,
  SerializedLanguageConfiguration,
  SignatureHelpContextDto,
  SingleEditOperation,
  WithDuration,
  WorkspaceEditDto,
} from '../../../common/vscode/model.api';
import {
  serializeAutoClosingPairs,
  serializeEnterRules,
  serializeIndentation,
  serializeRegExp,
} from '../../../common/vscode/utils';

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
import { InlineCompletionAdapter, InlineCompletionAdapterBase } from './language/inlineCompletion';
import { CodeLensAdapter } from './language/lens';
import { LinkProviderAdapter } from './language/link-provider';
import { LinkedEditingRangeAdapter } from './language/linked-editing-range';
import { NewSymbolNamesAdapter } from './language/new-symbol-names';
import { OnTypeFormattingAdapter } from './language/on-type-formatting';
import { OutlineAdapter } from './language/outline';
import { FormattingAdapter, RangeFormattingAdapter } from './language/range-formatting';
import { ReferenceAdapter } from './language/reference';
import { RenameAdapter } from './language/rename';
import { SelectionRangeAdapter } from './language/selection';
import { DocumentRangeSemanticTokensAdapter, DocumentSemanticTokensAdapter } from './language/semantic-tokens';
import { SignatureHelpAdapter } from './language/signature';
import { TypeDefinitionAdapter } from './language/type-definition';
import { TypeHierarchyAdapter } from './language/type-hierarchy';
import { getDurationTimer, score, targetsNotebooks } from './language/util';
import { WorkspaceSymbolAdapter } from './language/workspace-symbol';

import type { CodeActionContext } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

export function createLanguagesApiFactory(
  extHostLanguages: ExtHostLanguages,
  extHostNotebook: ExtensionNotebookDocumentManager,
  extension: IExtensionDescription,
): typeof vscode.languages {
  return {
    getLanguages(): Promise<string[]> {
      return extHostLanguages.getLanguages();
    },
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider, extension);
    },
    registerCompletionItemProvider(
      selector: DocumentSelector,
      provider: CompletionItemProvider,
      ...triggerCharacters: string[]
    ): Disposable {
      return extHostLanguages.registerCompletionItemProvider(selector, provider, triggerCharacters, extension);
    },
    registerInlineCompletionItemProvider(
      selector: vscode.DocumentSelector,
      provider: vscode.InlineCompletionItemProvider,
      metadata?: vscode.InlineCompletionItemProviderMetadata,
    ): vscode.Disposable {
      return extHostLanguages.registerInlineCompletionsProvider(extension, selector, provider, metadata);
    },
    registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
      return extHostLanguages.registerDefinitionProvider(selector, provider, extension);
    },
    registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable {
      return extHostLanguages.registerTypeDefinitionProvider(selector, provider, extension);
    },
    registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable {
      return extHostLanguages.registerFoldingRangeProvider(selector, provider, extension);
    },
    registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable {
      return extHostLanguages.registerColorProvider(selector, provider, extension);
    },
    registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
      return extHostLanguages.registerDocumentHighlightProvider(selector, provider, extension);
    },
    registerDocumentLinkProvider(selector: DocumentSelector, provider: DocumentLinkProvider): Disposable {
      return extHostLanguages.registerDocumentLinkProvider(selector, provider, extension);
    },
    registerReferenceProvider(selector: DocumentSelector, provider: ReferenceProvider): Disposable {
      return extHostLanguages.registerReferenceProvider(selector, provider, extension);
    },
    match(selector: DocumentSelector, document: TextDocument): number {
      const interalSelector = typeConvert.fromLanguageSelector(selector);
      let notebook: vscode.NotebookDocument | undefined;
      if (interalSelector && targetsNotebooks(interalSelector)) {
        notebook = extHostNotebook.notebookDocuments.find((value) =>
          value.getCells().find((c) => c.document === document),
        );
      }
      return score(interalSelector, document.uri, document.languageId, true, notebook?.uri, notebook?.notebookType);
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
      return extHostLanguages.registerWorkspaceSymbolProvider(provider, extension);
    },
    registerDocumentSymbolProvider(selector: DocumentSelector, provider: DocumentSymbolProvider) {
      return extHostLanguages.registerDocumentSymbolProvider(selector, provider, extension);
    },
    registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable {
      return extHostLanguages.registerImplementationProvider(selector, provider, extension);
    },
    registerDeclarationProvider(selector: DocumentSelector, provider: DeclarationProvider): Disposable {
      return extHostLanguages.registerDeclarationProvider(selector, provider, extension);
    },
    registerCodeActionsProvider(
      selector: DocumentSelector,
      provider: CodeActionProvider,
      metadata?: CodeActionProviderMetadata,
    ): Disposable {
      return extHostLanguages.registerCodeActionsProvider(extension, selector, provider, metadata);
    },
    registerRenameProvider(selector: DocumentSelector, provider: RenameProvider): Disposable {
      return extHostLanguages.registerRenameProvider(selector, provider, extension);
    },
    registerNewSymbolNamesProvider(selector: DocumentSelector, provider: NewSymbolNamesProvider): Disposable {
      return extHostLanguages.registerNewSymbolNamesProvider(selector, provider, extension);
    },
    registerSignatureHelpProvider(
      selector: DocumentSelector,
      provider: SignatureHelpProvider,
      firstItem?: string | SignatureHelpProviderMetadata,
      ...remaining: string[]
    ) {
      if (typeof firstItem === 'object') {
        return extHostLanguages.registerSignatureHelpProvider(selector, provider, firstItem, extension);
      }
      return extHostLanguages.registerSignatureHelpProvider(
        selector,
        provider,
        typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining],
        extension,
      );
    },
    registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
      return extHostLanguages.registerCodeLensProvider(selector, provider, extension);
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
        extension,
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
      return extHostLanguages.registerSelectionRangeProvider(selector, provider, extension);
    },
    registerCallHierarchyProvider(selector: DocumentSelector, provider: CallHierarchyProvider): Disposable {
      return extHostLanguages.registerCallHierarchyProvider(selector, provider, extension);
    },
    registerTypeHierarchyProvider(selector: DocumentSelector, provider: TypeHierarchyProvider): Disposable {
      return extHostLanguages.registerTypeHierarchyProvider(selector, provider, extension);
    },
    registerDocumentSemanticTokensProvider(
      selector: DocumentSelector,
      provider: DocumentSemanticTokensProvider,
      legend: SemanticTokensLegend,
    ): Disposable {
      return extHostLanguages.registerDocumentSemanticTokensProvider(selector, provider, legend, extension);
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
    registerDocumentDropEditProvider(
      selector: vscode.DocumentSelector,
      provider: vscode.DocumentDropEditProvider,
      metadata?: vscode.DocumentDropEditProviderMetadata,
    ): vscode.Disposable {
      return extHostLanguages.registerDocumentDropEditProvider(extension, selector, provider, metadata);
    },
    registerDocumentPasteEditProvider(
      selector: vscode.DocumentSelector,
      provider: vscode.DocumentPasteEditProvider,
      metadata: vscode.DocumentPasteProviderMetadata,
    ): vscode.Disposable {
      return extHostLanguages.registerDocumentPasteEditProvider(extension, selector, provider, metadata);
    },
    /**
     * @monaco-todo: wait until API is available in Monaco (1.85.0+)
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    registerMultiDocumentHighlightProvider(
      selector: vscode.DocumentSelector,
      provider: vscode.MultiDocumentHighlightProvider,
    ): vscode.Disposable {
      return toDisposable(() => {});
    },
  };
}

class AdapterData {
  constructor(readonly adapter: Adapter, readonly extension: IExtensionDescription) {}
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
  | TypeHierarchyAdapter
  | DocumentSemanticTokensAdapter
  | DocumentRangeSemanticTokensAdapter
  | EvaluatableExpressionAdapter
  | InlineValuesAdapter
  | LinkedEditingRangeAdapter
  | InlayHintsAdapter
  | InlineCompletionAdapter
  | NewSymbolNamesAdapter;

export class ExtHostLanguages implements IExtHostLanguages {
  private readonly proxy: IMainThreadLanguages;
  private readonly rpcProtocol: IRPCProtocol;
  private callId = 0;
  private _adapter = new Map<number, AdapterData>();
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
    return this.withAdapter(
      handle,
      CodeActionAdapter,
      (adapter) => adapter.resolveCodeAction(id, token),
      false,
      undefined,
    );
  }

  $releaseCodeActions(handle: number, cacheId: number): void {
    this.withAdapter(
      handle,
      CodeActionAdapter,
      (adapter) => Promise.resolve(adapter.releaseCodeActions(cacheId)),
      false,
      undefined,
    );
  }

  private nextCallId(): number {
    return this.callId++;
  }

  private createDisposable(callId: number): Disposable {
    return new Disposable(() => {
      this._adapter.delete(callId);
      this.proxy.$unregister(callId);
    });
  }

  private addNewAdapter(adapter: Adapter, extension: IExtensionDescription): number {
    const callId = this.nextCallId();
    this._adapter.set(callId, { adapter, extension });
    return callId;
  }

  private static _extLabel(ext: IExtensionDescription): string {
    return ext.displayName || ext.name;
  }

  private withAdapter<A, R>(
    handle: number,
    constructor: ConstructorOf<A>,
    callback: (adapter: A, extension: IExtensionDescription) => Promise<R>,
    allowCancellationError = false,
    fallbackValue: R,
  ): Promise<R> {
    const data = this._adapter.get(handle);
    if (!data || !data.adapter || !(data.adapter instanceof constructor)) {
      return Promise.resolve(fallbackValue);
    }
    const p = callback(data.adapter as A, data.extension);

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
  registerHoverProvider(
    selector: DocumentSelector,
    provider: HoverProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new HoverAdapter(provider, this.documents), extension);
    this.proxy.$registerHoverProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideHover(
    handle: number,
    resource: any,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined> {
    return this.withAdapter(
      handle,
      HoverAdapter,
      (adapter) => adapter.provideHover(resource, position, token),
      false,
      undefined,
    );
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
    return this.withAdapter(
      handle,
      CompletionAdapter,
      (adapter) => adapter.provideCompletionItems(resource, position, context, token),
      false,
      undefined,
    );
  }

  $resolveCompletionItem(
    handle: number,
    id: ChainedCacheId,
    token: CancellationToken,
  ): Promise<ISuggestDataDto | undefined> {
    return this.withAdapter(
      handle,
      CompletionAdapter,
      (adapter) => adapter.resolveCompletionItem(id, token),
      false,
      undefined,
    );
  }

  $releaseCompletionItems(handle: number, id: number): void {
    this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.releaseCompletionItems(id), false, undefined);
  }

  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    triggerCharacters: string[],
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(
      new CompletionAdapter(provider, this.commands.converter, this.documents),
      extension,
    );
    this.proxy.$registerCompletionSupport(
      callId,
      this.transformDocumentSelector(selector),
      triggerCharacters,
      CompletionAdapter.hasResolveSupport(provider),
    );
    return this.createDisposable(callId);
  }
  // ### Completion end

  // ### Inline Completion begin
  registerInlineCompletionsProvider(
    extension: IExtensionDescription,
    selector: vscode.DocumentSelector,
    provider: vscode.InlineCompletionItemProvider,
    metadata: vscode.InlineCompletionItemProviderMetadata | undefined,
  ): Disposable {
    const adapter = new InlineCompletionAdapter(extension, this.documents, provider, this.commands.converter);
    const callId = this.addNewAdapter(adapter, extension);
    this.proxy.$registerInlineCompletionsSupport(
      callId,
      this.transformDocumentSelector(selector),
      true,
      ExtensionIdentifier.toKey(extension.identifier.value),
      metadata?.yieldTo?.map((extId) => ExtensionIdentifier.toKey(extId)) || [],
    );
    return this.createDisposable(callId);
  }

  $provideInlineCompletions(
    handle: number,
    resource: UriComponents,
    position: IPosition,
    context: InlineCompletionContext,
    token: CancellationToken,
  ): Promise<IdentifiableInlineCompletions | undefined> {
    return this.withAdapter<InlineCompletionAdapterBase, IdentifiableInlineCompletions | undefined>(
      handle,
      InlineCompletionAdapterBase,
      (adapter) => adapter.provideInlineCompletions(Uri.revive(resource), position, context, token),
      undefined,
      undefined,
    );
  }

  $handleInlineCompletionDidShow(handle: number, pid: number, idx: number, updatedInsertText: string): void {
    this.withAdapter(
      handle,
      InlineCompletionAdapterBase,
      async (adapter) => {
        adapter.handleDidShowCompletionItem(pid, idx, updatedInsertText);
      },
      undefined,
      undefined,
    );
  }

  $handleInlineCompletionPartialAccept(handle: number, pid: number, idx: number, acceptedCharacters: number): void {
    this.withAdapter(
      handle,
      InlineCompletionAdapterBase,
      async (adapter) => {
        adapter.handlePartialAccept(pid, idx, acceptedCharacters);
      },
      undefined,
      undefined,
    );
  }

  $freeInlineCompletionsList(handle: number, pid: number): void {
    this.withAdapter(
      handle,
      InlineCompletionAdapterBase,
      async (adapter) => {
        adapter.disposeCompletions(pid);
      },
      undefined,
      undefined,
    );
  }
  // ### Inline Completion end

  // ### Definition provider begin
  $provideDefinition(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(
      handle,
      DefinitionAdapter,
      (adapter) => adapter.provideDefinition(resource, position, token),
      false,
      undefined,
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

  registerDefinitionProvider(
    selector: DocumentSelector,
    provider: DefinitionProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new DefinitionAdapter(provider, this.documents), extension);
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
    return this.withAdapter(
      handle,
      TypeDefinitionAdapter,
      (adapter) => adapter.provideTypeDefinition(resource, position, token),
      false,
      undefined,
    );
  }
  $provideTypeDefinitionWithDuration(handle: number, resource: Uri, position: Position, token: CancellationToken) {
    return this.withDurationRecord(() => this.$provideTypeDefinition(handle, resource, position, token));
  }

  registerTypeDefinitionProvider(
    selector: DocumentSelector,
    provider: TypeDefinitionProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new TypeDefinitionAdapter(provider, this.documents), extension);
    this.proxy.$registerTypeDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Type Definition provider end

  registerFoldingRangeProvider(
    selector: DocumentSelector,
    provider: FoldingRangeProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new FoldingProviderAdapter(this.documents, provider), extension);
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
    return this.withAdapter(
      handle,
      FoldingProviderAdapter,
      (adapter) => adapter.provideFoldingRanges(resource, context, token),
      false,
      undefined,
    );
  }

  // ### Color Provider begin
  registerColorProvider(
    selector: DocumentSelector,
    provider: DocumentColorProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new ColorProviderAdapter(this.documents, provider), extension);
    this.proxy.$registerDocumentColorProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentColors(handle: number, resource: Uri, token: CancellationToken): Promise<RawColorInfo[]> {
    return this.withAdapter(
      handle,
      ColorProviderAdapter,
      (adapter) => adapter.provideColors(resource, token),
      false,
      [],
    );
  }

  $provideColorPresentations(
    handle: number,
    resource: Uri,
    colorInfo: RawColorInfo,
    token: CancellationToken,
  ): Promise<ColorPresentation[]> {
    return this.withAdapter(
      handle,
      ColorProviderAdapter,
      (adapter) => adapter.provideColorPresentations(resource, colorInfo, token),
      false,
      [],
    );
  }
  // ### Color Provider end

  // ### Document Highlight Provider begin
  registerDocumentHighlightProvider(
    selector: DocumentSelector,
    provider: DocumentHighlightProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new DocumentHighlightAdapter(provider, this.documents), extension);
    this.proxy.$registerDocumentHighlightProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentHighlights(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | undefined> {
    return this.withAdapter(
      handle,
      DocumentHighlightAdapter,
      (adapter) => adapter.provideDocumentHighlights(resource, position, token),
      false,
      undefined,
    );
  }
  // ### Document Highlight Provider end

  // ### Document Formatting Provider begin
  registerDocumentFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentFormattingEditProvider,
  ): Disposable {
    const callId = this.addNewAdapter(new FormattingAdapter(provider, this.documents), extension);
    this.proxy.$registerDocumentFormattingProvider(callId, extension, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentFormattingEdits(
    handle: number,
    resource: Uri,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(
      handle,
      FormattingAdapter,
      (adapter) => adapter.provideDocumentFormattingEdits(resource, options),
      false,
      undefined,
    );
  }
  // ### Document Formatting Provider end

  // ### Document Range Formatting Provider begin
  registerDocumentRangeFormattingEditProvider(
    extension: IExtensionDescription,
    selector: DocumentSelector,
    provider: DocumentRangeFormattingEditProvider,
  ): Disposable {
    const callId = this.addNewAdapter(new RangeFormattingAdapter(provider, this.documents), extension);
    this.proxy.$registerRangeFormattingProvider(callId, extension, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentRangeFormattingEdits(
    handle: number,
    resource: Uri,
    range: Range,
    options: FormattingOptions,
  ): Promise<SingleEditOperation[] | undefined> {
    return this.withAdapter(
      handle,
      RangeFormattingAdapter,
      (adapter) => adapter.provideDocumentRangeFormattingEdits(resource, range, options),
      false,
      undefined,
    );
  }
  // ### Document Range Formatting Provider end

  // ### Document Type Formatting Provider begin
  registerOnTypeFormattingEditProvider(
    selector: DocumentSelector,
    provider: OnTypeFormattingEditProvider,
    triggerCharacters: string[],
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new OnTypeFormattingAdapter(provider, this.documents), extension);
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
    return this.withAdapter(
      handle,
      OnTypeFormattingAdapter,
      (adapter) => adapter.provideOnTypeFormattingEdits(resource, position, ch, options),
      false,
      undefined,
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
  registerCodeLensProvider(
    selector: DocumentSelector,
    provider: CodeLensProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(
      new CodeLensAdapter(provider, this.documents, this.commands.converter),
      extension,
    );
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
    return this.withAdapter(
      handle,
      CodeLensAdapter,
      (adapter) => adapter.provideCodeLenses(resource, token),
      false,
      undefined,
    );
  }

  $resolveCodeLens(handle: number, symbol: CodeLens, token: CancellationToken): Promise<CodeLens | undefined> {
    return this.withAdapter(
      handle,
      CodeLensAdapter,
      (adapter) => adapter.resolveCodeLens(symbol, token),
      false,
      undefined,
    );
  }

  $releaseCodeLens(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(
      handle,
      CodeLensAdapter,
      (adapter) => Promise.resolve(adapter.releaseCodeLens(cacheId)),
      false,
      undefined,
    );
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
    const callId = this.addNewAdapter(new CodeActionAdapter(provider, this.documents, this.diagnostics), extension);
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
    token: CancellationToken,
  ): Promise<ICodeActionListDto | undefined> {
    return this.withAdapter(
      handle,
      CodeActionAdapter,
      (adapter) => adapter.provideCodeActions(resource, rangeOrSelection, context, this.commands.converter, token),
      false,
      undefined,
    );
  }
  // ### Code Actions Provider end

  // ### Implementation provider begin
  $provideImplementation(
    handle: number,
    resource: Uri,
    position: Position,
  ): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(
      handle,
      ImplementationAdapter,
      (adapter) => adapter.provideImplementation(resource, position),
      false,
      undefined,
    );
  }
  $provideImplementationWithDuration(
    handle: number,
    resource: Uri,
    position: Position,
  ): Promise<WithDuration<Definition | DefinitionLink[] | undefined>> {
    return this.withDurationRecord(() => this.$provideImplementation(handle, resource, position));
  }

  registerImplementationProvider(
    selector: DocumentSelector,
    provider: ImplementationProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new ImplementationAdapter(provider, this.documents), extension);
    this.proxy.$registerImplementationProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Implementation provider end

  // ### Declaration provider begin
  registerDeclarationProvider(
    selector: DocumentSelector,
    provider: DeclarationProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new DeclarationAdapter(provider, this.documents), extension);
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
    return this.withAdapter(
      handle,
      LinkProviderAdapter,
      (adapter) => adapter.provideLinks(resource, token),
      false,
      undefined,
    );
  }

  $resolveDocumentLink(handle: number, id: ChainedCacheId, token: CancellationToken): Promise<ILink | undefined> {
    return this.withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.resolveLink(id, token), false, undefined);
  }

  $releaseDocumentLinks(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(
      handle,
      LinkProviderAdapter,
      (adapter) => Promise.resolve(adapter.releaseLink(cacheId)),
      false,
      undefined,
    );
  }

  registerDocumentLinkProvider(
    selector: DocumentSelector,
    provider: DocumentLinkProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new LinkProviderAdapter(provider, this.documents), extension);
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
    return this.withAdapter(
      handle,
      ReferenceAdapter,
      (adapter) => adapter.provideReferences(resource, position, context, token),
      false,
      undefined,
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

  registerReferenceProvider(
    selector: DocumentSelector,
    provider: ReferenceProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new ReferenceAdapter(provider, this.documents), extension);
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
      autoClosingPairs: serializeAutoClosingPairs(configuration.autoClosingPairs),
    };
    this.proxy.$setLanguageConfiguration(callId, language, config);
    return this.createDisposable(callId);
  }

  // ### Document Symbol Provider begin
  registerDocumentSymbolProvider(
    selector: DocumentSelector,
    provider: DocumentSymbolProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new OutlineAdapter(this.documents, provider), extension);
    this.proxy.$registerOutlineSupport(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentSymbols(
    handle: number,
    resource: Uri,
    token: CancellationToken,
  ): Promise<DocumentSymbol[] | undefined> {
    return this.withAdapter(
      handle,
      OutlineAdapter,
      (adapter) => adapter.provideDocumentSymbols(resource, token),
      false,
      undefined,
    );
  }
  // ### Document Symbol Provider end

  // ### WorkspaceSymbol Provider begin
  registerWorkspaceSymbolProvider(provider: WorkspaceSymbolProvider, extension: IExtensionDescription): Disposable {
    const callId = this.addNewAdapter(new WorkspaceSymbolAdapter(provider), extension);
    this.proxy.$registerWorkspaceSymbolProvider(callId);
    return this.createDisposable(callId);
  }

  $provideWorkspaceSymbols(handle: number, query: string, token: CancellationToken): PromiseLike<SymbolInformation[]> {
    return this.withAdapter(
      handle,
      WorkspaceSymbolAdapter,
      (adapter) => adapter.provideWorkspaceSymbols(query, token),
      false,
      [],
    );
  }

  $resolveWorkspaceSymbol(
    handle: number,
    symbol: SymbolInformation,
    token: CancellationToken,
  ): PromiseLike<SymbolInformation | undefined> {
    return this.withAdapter(
      handle,
      WorkspaceSymbolAdapter,
      (adapter) => adapter.resolveWorkspaceSymbol(symbol, token),
      false,
      undefined,
    );
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
    return this.withAdapter(
      handle,
      SignatureHelpAdapter,
      (adapter) => adapter.provideSignatureHelp(resource, position, token, context),
      false,
      undefined,
    );
  }

  $releaseSignatureHelp(handle: number, cacheId: number): Promise<void> {
    return this.withAdapter(
      handle,
      SignatureHelpAdapter,
      (adapter) => Promise.resolve(adapter.releaseSignatureHelp(cacheId)),
      false,
      undefined,
    );
  }

  registerSignatureHelpProvider(
    selector: DocumentSelector,
    provider: SignatureHelpProvider,
    metadataOrTriggerChars: string[] | SignatureHelpProviderMetadata,
    extension: IExtensionDescription,
  ): Disposable {
    const metadata: ISerializedSignatureHelpProviderMetadata | undefined = Array.isArray(metadataOrTriggerChars)
      ? { triggerCharacters: metadataOrTriggerChars, retriggerCharacters: [] }
      : metadataOrTriggerChars;
    const callId = this.addNewAdapter(new SignatureHelpAdapter(provider, this.documents), extension);
    this.proxy.$registerSignatureHelpProvider(callId, this.transformDocumentSelector(selector), metadata);
    return this.createDisposable(callId);
  }

  // ### Signature help end
  // ### Rename Provider begin
  registerRenameProvider(
    selector: DocumentSelector,
    provider: RenameProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new RenameAdapter(provider, this.documents), extension);
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
    return this.withAdapter(
      handle,
      RenameAdapter,
      (adapter) => adapter.provideRenameEdits(resource, position, newName, token),
      false,
      undefined,
    );
  }

  $resolveRenameLocation(
    handle: number,
    resource: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<RenameLocation | undefined> {
    return this.withAdapter(
      handle,
      RenameAdapter,
      (adapter) => adapter.resolveRenameLocation(resource, position, token),
      false,
      undefined,
    );
  }
  // ### Rename Provider end

  // ### New Symbol Names Provider start
  registerNewSymbolNamesProvider(
    selector: DocumentSelector,
    provider: NewSymbolNamesProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new NewSymbolNamesAdapter(provider, this.documents), extension);
    this.proxy.$registerNewSymbolNamesProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideNewSymbolNames(
    handle: number,
    resource: Uri,
    range: Range,
    token: CancellationToken,
  ): Promise<NewSymbolName[] | undefined> {
    return this.withAdapter(
      handle,
      NewSymbolNamesAdapter,
      (adapter) => adapter.provideNewSymbolNames(resource, range, token),
      false,
      undefined,
    );
  }
  // ### New Symbol Names Provider end

  // ### smart select
  registerSelectionRangeProvider(
    selector: DocumentSelector,
    provider: SelectionRangeProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new SelectionRangeAdapter(this.documents, provider), extension);
    this.proxy.$registerSelectionRangeProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideSelectionRanges(
    handle: number,
    resource: Uri,
    positions: Position[],
    token: CancellationToken,
  ): Promise<SelectionRange[][]> {
    return this.withAdapter(
      handle,
      SelectionRangeAdapter,
      (adapter) => adapter.provideSelectionRanges(resource, positions, token),
      false,
      [],
    );
  }

  registerCallHierarchyProvider(
    selector: DocumentSelector,
    provider: CallHierarchyProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new CallHierarchyAdapter(this.documents, provider), extension);
    this.proxy.$registerCallHierarchyProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $prepareCallHierarchy(
    handle: number,
    resource: UriComponents,
    position: Position,
    token: CancellationToken,
  ): Promise<ICallHierarchyItemDto[] | undefined> {
    return this.withAdapter(
      handle,
      CallHierarchyAdapter,
      (adapter) => Promise.resolve(adapter.prepareSession(Uri.revive(resource), position, token)),
      false,
      undefined,
    );
  }

  $provideCallHierarchyIncomingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IIncomingCallDto[] | undefined> {
    return this.withAdapter(
      handle,
      CallHierarchyAdapter,
      (adapter) => adapter.provideCallsTo(sessionId, itemId, token),
      false,
      undefined,
    );
  }

  $provideCallHierarchyOutgoingCalls(
    handle: number,
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IOutgoingCallDto[] | undefined> {
    return this.withAdapter(
      handle,
      CallHierarchyAdapter,
      (adapter) => adapter.provideCallsFrom(sessionId, itemId, token),
      false,
      undefined,
    );
  }

  $releaseCallHierarchy(handle: number, sessionId: string): void {
    this.withAdapter(
      handle,
      CallHierarchyAdapter,
      (adapter) => Promise.resolve(adapter.releaseSession(sessionId)),
      false,
      undefined,
    );
  }

  registerTypeHierarchyProvider(
    selector: DocumentSelector,
    provider: TypeHierarchyProvider,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new TypeHierarchyAdapter(this.documents, provider), extension);
    this.proxy.$registerTypeHierarchyProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $prepareTypeHierarchy(handle: number, resource: UriComponents, position: Position, token: CancellationToken) {
    return this.withAdapter(
      handle,
      TypeHierarchyAdapter,
      (adapter) => Promise.resolve(adapter.prepareSession(Uri.revive(resource), position, token)),
      false,
      undefined,
    );
  }

  $provideTypeHierarchySupertypes(handle: number, sessionId: string, itemId: string, token: CancellationToken) {
    return this.withAdapter(
      handle,
      TypeHierarchyAdapter,
      (adapter) => adapter.provideSupertypes(sessionId, itemId, token),
      false,
      undefined,
    );
  }

  $provideTypeHierarchySubtypes(handle: number, sessionId: string, itemId: string, token: CancellationToken) {
    return this.withAdapter(
      handle,
      TypeHierarchyAdapter,
      (adapter) => adapter.provideSubtypes(sessionId, itemId, token),
      false,
      undefined,
    );
  }

  $releaseTypeHierarchy(handle: number, sessionId: string) {
    this.withAdapter(
      handle,
      TypeHierarchyAdapter,
      (adapter) => Promise.resolve(adapter.releaseSession(sessionId)),
      false,
      undefined,
    );
  }

  // #region Semantic Tokens
  registerDocumentSemanticTokensProvider(
    selector: DocumentSelector,
    provider: DocumentSemanticTokensProvider,
    legend: SemanticTokensLegend,
    extension: IExtensionDescription,
  ): Disposable {
    const callId = this.addNewAdapter(new DocumentSemanticTokensAdapter(this.documents, provider), extension);
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
      null,
    );
  }

  $releaseDocumentSemanticTokens(handle: number, semanticColoringResultId: number): void {
    this.withAdapter(
      handle,
      DocumentSemanticTokensAdapter,
      (adapter) => adapter.releaseDocumentSemanticColoring(semanticColoringResultId),
      false,
      undefined,
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
    return this.withAdapter(
      handle,
      DocumentRangeSemanticTokensAdapter,
      (adapter) => adapter.provideDocumentRangeSemanticTokens(Uri.revive(resource), range, token),
      false,
      null,
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
    return this.withAdapter(
      handle,
      EvaluatableExpressionAdapter,
      (adapter) => adapter.provideEvaluatableExpression(Uri.revive(resource), position, token),
      false,
      undefined,
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
      false,
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
      false,
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
    const handle = this.addNewAdapter(
      new InlayHintsAdapter(this.documents, provider, this.commands.converter),
      extension,
    );

    this.proxy.$registerInlayHintsProvider(
      handle,
      this.transformDocumentSelector(selector),
      typeof provider.resolveInlayHint === 'function',
      eventHandle,
      ExtHostLanguages._extLabel(extension),
    );
    let result = this.createDisposable(handle);

    if (eventHandle !== undefined) {
      const subscription = provider.onDidChangeInlayHints!(() => this.proxy.$emitInlayHintsEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }

  $provideInlayHints(
    handle: number,
    resource: UriComponents,
    range: Range,
    token: CancellationToken,
  ): Promise<IInlayHintsDto | undefined> {
    return this.withAdapter(
      handle,
      InlayHintsAdapter,
      (adapter) => adapter.provideInlayHints(Uri.revive(resource), range, token),
      false,
      undefined,
    );
  }

  $resolveInlayHint(handle: number, id: ChainedCacheId, token: CancellationToken): Promise<IInlayHintDto | undefined> {
    return this.withAdapter(
      handle,
      InlayHintsAdapter,
      (adapter) => adapter.resolveInlayHint(id, token),
      true,
      undefined,
    );
  }

  $releaseInlayHints(handle: number, id: number): void {
    this.withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.releaseHints(id), false, undefined);
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
      busy: false,
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
          busy: data.busy,
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
      get busy() {
        return data.busy;
      },
      set busy(value: boolean) {
        data.busy = value;
        updateAsync();
      },
    };
    updateAsync();
    return result;
  }

  registerDocumentDropEditProvider(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    extension: IExtensionDescription,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selector: vscode.DocumentSelector,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provider: vscode.DocumentDropEditProvider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadata?: vscode.DocumentDropEditProviderMetadata,
  ) {
    return toDisposable(() => {});
  }

  registerDocumentPasteEditProvider(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    extension: IExtensionDescription,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selector: vscode.DocumentSelector,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provider: vscode.DocumentPasteEditProvider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    metadata: vscode.DocumentPasteProviderMetadata,
  ) {
    return toDisposable(() => {});
  }
}
