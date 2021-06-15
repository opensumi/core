import * as modes from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, MaybeNull, OnEvent, BasicEvent, URI, CancellationTokenSource } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '../../common';
import { IEditorDocumentModelService, EditorDocumentModelContentChangedEvent } from '../doc-model/types';
import debounce = require('lodash.debounce');
import { DocumentSymbol, SymbolTag } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';

@Injectable()
export class DocumentSymbolStore extends WithEventBus {

  @Autowired(IEditorDocumentModelService)
  editorDocumentModelRegistry: IEditorDocumentModelService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  private documentSymbols = new Map<string, INormalizedDocumentSymbol[] | undefined>();

  private pendingUpdate = new Set<string>();

  private debounced = new Map<string, () => any>();

  constructor() {
    super();
    this.addDispose(modes.DocumentSymbolProviderRegistry.onDidChange(() => {
      Array.from(this.documentSymbols.keys()).forEach((uriString) => {
        this.markNeedUpdate(new URI(uriString));
      });
    }));
  }

  getDocumentSymbol(uri: URI): INormalizedDocumentSymbol[] | undefined {
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
      const supports = await modes.DocumentSymbolProviderRegistry.all(modelRef.instance.getMonacoModel());
      let result: MaybeNull<DocumentSymbol[]>;
      for (const support of supports) {
        result = await support.provideDocumentSymbols(modelRef.instance.getMonacoModel(), new CancellationTokenSource().token);
        if (result) {
          break;
        }
      }
      if (result) {
        normalizeDocumentSymbols(result, { children: result } as INormalizedDocumentSymbol, uri);
      }
      this.documentSymbols.set(uri.toString(), result as INormalizedDocumentSymbol[]);
      this.eventBus.fire(new DocumentSymbolChangedEvent(uri));
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

export {
  DocumentSymbol,
  SymbolTag,
};

export interface INormalizedDocumentSymbol extends DocumentSymbol {
  parent?: INormalizedDocumentSymbol | IDummyRoot;
  children?: INormalizedDocumentSymbol[];
  id: string;
}

export interface IDummyRoot {
  children?: INormalizedDocumentSymbol[];
}

function normalizeDocumentSymbols(documentSymbols: DocumentSymbol[], parent: INormalizedDocumentSymbol | IDummyRoot, uri: URI): INormalizedDocumentSymbol[] {
  documentSymbols.forEach((documentSymbol, index) => {
    const symbol = documentSymbol as INormalizedDocumentSymbol;
    symbol.parent = parent;
    symbol.id = getSymbolId(uri, symbol, index);
    if (documentSymbol.children && documentSymbol.children.length > 0) {
      normalizeDocumentSymbols(documentSymbol.children, documentSymbol as INormalizedDocumentSymbol, uri);
    }
  });
  return documentSymbols as INormalizedDocumentSymbol[];
}

function getSymbolId(uri: URI, symbol: INormalizedDocumentSymbol, index: number) {
  const symbolNameList: string[] = [symbol.name];
  while (symbol.parent) {
    const parent = symbol.parent as INormalizedDocumentSymbol;
    // dummyRoot
    if (!parent.name) {
      break;
    }
    symbolNameList.unshift(parent.name);
    symbol = parent;
  }
  return `${uri.toString()}__${symbolNameList.join('-')}__${index}`;
}
