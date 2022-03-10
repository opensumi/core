import debounce = require('lodash.debounce');

import { Injectable, Autowired } from '@opensumi/di';
import {
  WithEventBus,
  MaybeNull,
  OnEvent,
  BasicEvent,
  URI,
  CancellationTokenSource,
  Deferred,
  CancellationToken,
} from '@opensumi/ide-core-browser';
import * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import { DocumentSymbol, SymbolTag } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { WorkbenchEditorService } from '../../common';
import { IEditorDocumentModelService, EditorDocumentModelContentChangedEvent } from '../doc-model/types';

@Injectable()
export class DocumentSymbolStore extends WithEventBus {
  @Autowired(IEditorDocumentModelService)
  editorDocumentModelRegistry: IEditorDocumentModelService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  private documentSymbols = new Map<string, INormalizedDocumentSymbol[] | undefined>();

  private pendingUpdate = new Set<string>();

  private debounced = new Map<string, () => any>();

  private symbolDeferred = new Map<string, Deferred<void>>();

  constructor() {
    super();
    this.addDispose(
      modes.DocumentSymbolProviderRegistry.onDidChange(() => {
        Array.from(this.documentSymbols.keys()).forEach((uriString) => {
          this.markNeedUpdate(new URI(uriString));
        });
      }),
    );
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

  /**
   * 等待获取文件 symbol，否则文件搜索一个未打开过的文件 symbols 为空
   */
  async getDocumentSymbolAsync(uri: URI, token?: CancellationToken): Promise<INormalizedDocumentSymbol[] | undefined> {
    const uriStr = uri.toString();
    if (token) {
      token.onCancellationRequested(() => {
        this.symbolDeferred.get(uriStr)?.resolve();
        this.symbolDeferred.delete(uriStr);
      });
    }
    if ((!this.documentSymbols.has(uriStr) || this.pendingUpdate.has(uriStr)) && !this.symbolDeferred.has(uriStr)) {
      this.symbolDeferred.set(uriStr, new Deferred());
      this.updateDocumentSymbolCache(uri);
    }
    await this.symbolDeferred.get(uriStr)?.promise;
    return this.documentSymbols.get(uriStr);
  }

  async createDocumentSymbolCache(uri: URI) {
    this.updateDocumentSymbolCache(uri);
  }

  async doUpdateDocumentSymbolCache(uri: URI) {
    this.pendingUpdate.delete(uri.toString());
    const modelRef = await this.editorDocumentModelRegistry.createModelReference(uri);
    if (!modelRef) {
      this.symbolDeferred.get(uri.toString())?.resolve();
      return;
    }
    try {
      const supports = await modes.DocumentSymbolProviderRegistry.all(modelRef.instance.getMonacoModel());
      let result: MaybeNull<DocumentSymbol[]>;
      for (const support of supports) {
        result = await support.provideDocumentSymbols(
          modelRef.instance.getMonacoModel(),
          new CancellationTokenSource().token,
        );
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
    this.symbolDeferred.get(uri.toString())?.resolve();
  }

  updateDocumentSymbolCache(uri: URI) {
    if (!this.debounced.has(uri.toString())) {
      this.debounced.set(
        uri.toString(),
        debounce(() => this.doUpdateDocumentSymbolCache(uri), 100, { maxWait: 1000 }),
      );
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

export class DocumentSymbolChangedEvent extends BasicEvent<URI> {}

export { DocumentSymbol, SymbolTag };

export interface INormalizedDocumentSymbol extends DocumentSymbol {
  parent?: INormalizedDocumentSymbol | IDummyRoot;
  children?: INormalizedDocumentSymbol[];
  id: string;
}

export interface IDummyRoot {
  children?: INormalizedDocumentSymbol[];
}

function normalizeDocumentSymbols(
  documentSymbols: DocumentSymbol[],
  parent: INormalizedDocumentSymbol | IDummyRoot,
  uri: URI,
): INormalizedDocumentSymbol[] {
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
