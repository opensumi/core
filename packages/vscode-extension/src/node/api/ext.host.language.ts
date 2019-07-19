import { ConstructorOf, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, ExtensionDocumentDataManager, IMainThreadLanguages } from '../../common';
import { HoverAdapter } from '../language/hover';
import { DocumentSelector, HoverProvider, CancellationToken, DocumentHighlightProvider, DocumentFilter, CompletionItemProvider, CompletionList, DefinitionProvider, TypeDefinitionProvider, FoldingRangeProvider, FoldingContext, DocumentColorProvider } from 'vscode';
import { SerializedDocumentFilter, Hover, Position, CompletionResultDto, Completion, CompletionContext, Definition, DefinitionLink, FoldingRange, RawColorInfo, ColorPresentation, DocumentHighlight } from '../../common/model.api';
import URI, { UriComponents } from 'vscode-uri';
import { Disposable } from '../../common/ext-types';
import { CompletionAdapter } from '../language/completion';
import { DefinitionAdapter } from '../language/definition';
import { TypeDefinitionAdapter } from '../language/type-definition';
import { FoldingProviderAdapter } from '../language/folding';
import { ColorProviderAdapter } from '../language/color';
import { DocumentHighlightAdapter } from '../language/document-highlight';

export type Adapter =
  HoverAdapter |
  CompletionAdapter |
  DefinitionAdapter |
  TypeDefinitionAdapter |
  FoldingProviderAdapter |
  ColorProviderAdapter |
  DocumentHighlightAdapter;

export class ExtHostLanguages {
  private readonly proxy: IMainThreadLanguages;
  private readonly rpcProtocol: IRPCProtocol;
  private callId = 0;
  private adaptersMap = new Map<number, Adapter>();

  constructor(rpcProtocol: IRPCProtocol, private documents: ExtensionDocumentDataManager) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadLanguages);
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

  private addNewAdapter(adapter: Adapter): number {
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

  // NOTE vscode插件调用此api，会将回调函数绑定到一个回调id发到前台，前台处理时远程调用此回调id拿到处理结果
  registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
    const callId = this.addNewAdapter(new HoverAdapter(provider, this.documents));
    this.proxy.$registerHoverProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // TODO 提供main调用的回调函数
  $provideHover(handle: number, resource: any, position: Position, token: CancellationToken): Promise<Hover | undefined> {
    return this.withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(URI.revive(resource), position, token));
  }

  // ### Completion begin
  $provideCompletionItems(handle: number, resource: UriComponents, position: Position,
                          context: CompletionContext, token: CancellationToken) {
    return this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.provideCompletionItems(URI.revive(resource), position, context, token));
  }

  $resolveCompletionItem(handle: number, resource: UriComponents, position: Position, completion: Completion, token: CancellationToken): Promise<Completion> {
    return this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.resolveCompletionItem(URI.revive(resource), position, completion, token));
  }

  $releaseCompletionItems(handle: number, id: number): void {
    this.withAdapter(handle, CompletionAdapter, (adapter) => adapter.releaseCompletionItems(id));
  }

  registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, triggerCharacters: string[]): Disposable {
    const callId = this.addNewAdapter(new CompletionAdapter(provider, this.documents));
    this.proxy.$registerCompletionSupport(callId, this.transformDocumentSelector(selector), triggerCharacters, CompletionAdapter.hasResolveSupport(provider));
    return this.createDisposable(callId);
  }
  // ### Completion end

  // ### Definition provider begin
  $provideDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, DefinitionAdapter, (adapter) => adapter.provideDefinition(URI.revive(resource), position, token));
  }

  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
    const callId = this.addNewAdapter(new DefinitionAdapter(provider, this.documents));
    this.proxy.$registerDefinitionProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }
  // ### Definition provider end

  // ### Type Definition provider begin
  $provideTypeDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined> {
    return this.withAdapter(handle, TypeDefinitionAdapter, (adapter) => adapter.provideTypeDefinition(URI.revive(resource), position, token));
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

  $provideFoldingRange(handle: number, resource: UriComponents, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[] | undefined> {
    return this.withAdapter(handle, FoldingProviderAdapter, (adapter) => adapter.provideFoldingRanges(URI.revive(resource), context, token));
  }

  // ### Color Provider begin
  registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable {
    const callId = this.addNewAdapter(new ColorProviderAdapter(this.documents, provider));
    this.proxy.$registerDocumentColorProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentColors(handle: number, resource: UriComponents, token: CancellationToken): Promise<RawColorInfo[]> {
    return this.withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColors(URI.revive(resource), token));
  }

  $provideColorPresentations(handle: number, resource: UriComponents, colorInfo: RawColorInfo, token: CancellationToken): Promise<ColorPresentation[]> {
    return this.withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColorPresentations(URI.revive(resource), colorInfo, token));
  }
  // ### Color Provider end

  // ### Document Highlight Provider begin
  registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
    const callId = this.addNewAdapter(new DocumentHighlightAdapter(provider, this.documents));
    this.proxy.$registerDocumentHighlightProvider(callId, this.transformDocumentSelector(selector));
    return this.createDisposable(callId);
  }

  $provideDocumentHighlights(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<DocumentHighlight[] | undefined> {
    return this.withAdapter(handle, DocumentHighlightAdapter, (adapter) => adapter.provideDocumentHighlights(URI.revive(resource), position, token));
  }
  // ### Document Highlight Provider end
}
