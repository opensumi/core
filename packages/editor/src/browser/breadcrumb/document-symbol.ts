import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, MaybeNull, OnEvent, BasicEvent, IRange, URI, CancellationTokenSource, SymbolKind } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '../../common';
import { IEditorDocumentModelService, EditorDocumentModelContentChangedEvent } from '../doc-model/types';
import debounce = require('lodash.debounce');

@Injectable()
export class DocumentSymbolStore extends WithEventBus {

  @Autowired(IEditorDocumentModelService)
  editorDocumentModelRegistry: IEditorDocumentModelService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  private documentSymbols = new Map<string, DocumentSymbol[] | undefined>();

  private pendingUpdate = new Set<string>();

  private debounced = new Map<string, () => any>();

  constructor() {
    super();
    monaco.modes.DocumentSymbolProviderRegistry.onDidChange(() => {
      Array.from(this.documentSymbols.keys()).forEach((uriString) => {
        this.markNeedUpdate(new URI(uriString));
      });
    });
  }

  getDocumentSymbol(uri: URI): DocumentSymbol[] | undefined {
    if (!this.documentSymbols.has(uri.toString())) {
      this.documentSymbols.set(uri.toString(), undefined);
      this.createDocumentSymbolCache(uri);
    }
    if (this.pendingUpdate.has(uri.toString())) {
      this.updateDocumentSymbolCache(uri);
    }
    return this.documentSymbols.get(uri.toString());
  }

  async createDocumentSymbolCache(uri: URI) {
    this.updateDocumentSymbolCache(uri);
  }

  async doUpdateDocumentSymbolCache(uri: URI) {
    this.pendingUpdate.delete(uri.toString());
    const modelRef = await this.editorDocumentModelRegistry.createModelReference(uri);
    if (!modelRef) {
      return;
    }
    try {
      const supports = await monaco.modes.DocumentSymbolProviderRegistry.all(modelRef.instance.getMonacoModel());
      let result: MaybeNull<DocumentSymbol[]>;
      for (const support of supports) {
        result = await support.provideDocumentSymbols(modelRef.instance.getMonacoModel(), new CancellationTokenSource().token);
        if (result) {
          break;
        }
      }
      if (result) {
        this.documentSymbols.set(uri.toString(), result);
        this.eventBus.fire(new DocumentSymbolChangedEvent(uri));
      }
    } finally {
      modelRef.dispose();
    }
  }

  updateDocumentSymbolCache(uri: URI) {
    if (!this.debounced.has(uri.toString())) {
      this.debounced.set(uri.toString(), debounce(() => {
        return this.doUpdateDocumentSymbolCache(uri);
      }, 100, { maxWait: 1000 }));
    }
    this.debounced.get(uri.toString())!();
  }

  @OnEvent(EditorDocumentModelContentChangedEvent)
  onEditorDocumentModelContentChangedEvent(e: EditorDocumentModelContentChangedEvent) {
    if (e.payload.changes && e.payload.changes.length > 0) {
      this.markNeedUpdate(e.payload.uri);
    }
  }

  private markNeedUpdate(uri: URI) {
    this.pendingUpdate.add(uri.toString());
    if (this.isWatching(uri)) {
      this.updateDocumentSymbolCache(uri);
    }
  }

  private isWatching(uri: URI): boolean {
    for (const g of this.editorService.editorGroups) {
      if (g.currentResource && g.currentResource.uri.isEqual(uri)) {
        return true;
      }
    }
    return false;
  }

}

export class DocumentSymbolChangedEvent extends BasicEvent<URI> { }

export interface DocumentSymbol {
  name: string;
  detail: string;
  kind: SymbolKind;
  containerName?: string;
  range: IRange;
  selectionRange: IRange;
  children?: DocumentSymbol[];
}
