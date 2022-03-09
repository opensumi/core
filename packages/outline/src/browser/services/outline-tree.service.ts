import { Injectable, Autowired } from '@opensumi/di';
import { Tree, ITreeNodeOrCompositeTreeNode } from '@opensumi/ide-components';
import {
  URI,
  Emitter,
  MaybeNull,
  IdleValue,
  compareRangesUsingStarts,
  getSymbolIcon,
  Event,
  StorageProvider,
  STORAGE_NAMESPACE,
  IStorage,
} from '@opensumi/ide-core-browser';
import {
  DocumentSymbolStore,
  INormalizedDocumentSymbol,
} from '@opensumi/ide-editor/lib/browser/breadcrumb/document-symbol';

import { OutlineSortOrder } from '../../common';
import { OutlineCompositeTreeNode, OutlineTreeNode, OutlineRoot } from '../outline-node.define';

import { OutlineContextKeyService } from './outline-contextkey.service';

@Injectable()
export class OutlineTreeService extends Tree {
  @Autowired(DocumentSymbolStore)
  private documentSymbolStore: DocumentSymbolStore;

  @Autowired(OutlineContextKeyService)
  private outlineContextKeyService: OutlineContextKeyService;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  // 处理字符串排序，IdleValue 在空闲或需要时执行 [idle-or-urgent stratage implementation](https://philipwalton.com/articles/idle-until-urgent)
  private readonly collator = new IdleValue<Intl.Collator>(() => new Intl.Collator(undefined, { numeric: true }));
  private readonly cacheOutlineNodes: Map<string, OutlineCompositeTreeNode | OutlineTreeNode> = new Map();

  private _sortType: OutlineSortOrder = OutlineSortOrder.ByPosition;
  private _followCursor = false;

  private _currentUri: MaybeNull<URI>;

  private onDidChangeEmitter: Emitter<void> = new Emitter();

  private _whenReady: Promise<void>;

  private _outlineStorage: IStorage;

  constructor() {
    super();
    this._whenReady = this.init();
  }

  async init() {
    this._outlineStorage = await this.storageProvider(STORAGE_NAMESPACE.OUTLINE);
    this._sortType = this._outlineStorage.get('sortType', OutlineSortOrder.ByPosition);
    this.outlineContextKeyService.outlineSortTypeContext.set(this._sortType);
    this._followCursor = this._outlineStorage.get('followCursor', false);
    this.outlineContextKeyService.outlineFollowCursorContext.set(this._followCursor);
  }

  get whenReady() {
    return this._whenReady;
  }

  get onDidChange(): Event<void> {
    return this.onDidChangeEmitter.event;
  }

  get currentUri() {
    return this._currentUri;
  }

  set currentUri(value: MaybeNull<URI>) {
    this._currentUri = value;
  }

  get followCursor() {
    return this._followCursor;
  }

  set followCursor(value: boolean) {
    if (this._followCursor === value) {
      return;
    }
    this._followCursor = value;
    this.outlineContextKeyService.outlineFollowCursorContext.set(value);
    this._outlineStorage.set('followCursor', value);
    this.onDidChangeEmitter.fire();
  }

  get sortType() {
    return this._sortType;
  }

  set sortType(type: OutlineSortOrder) {
    if (this._sortType === type) {
      return;
    }
    this._sortType = type;
    this.outlineContextKeyService.outlineSortTypeContext.set(type);
    this._outlineStorage.set('sortType', type);
    this.onDidChangeEmitter.fire();
  }

  async resolveChildren(
    parent?: OutlineCompositeTreeNode,
  ): Promise<(OutlineCompositeTreeNode | OutlineRoot | OutlineTreeNode)[]> {
    let children: (OutlineCompositeTreeNode | OutlineRoot | OutlineTreeNode)[] = [];
    if (!parent) {
      children = [new OutlineRoot(this, this.currentUri)];
    } else if (parent) {
      if (!OutlineCompositeTreeNode.is(parent)) {
        if (!((parent as OutlineRoot).currentUri || this.currentUri)) {
          return [];
        }
        const symbols = this.documentSymbolStore.getDocumentSymbol(
          ((parent as OutlineRoot).currentUri || this.currentUri)!,
        );
        children =
          symbols?.map((symbol: INormalizedDocumentSymbol) => {
            const cache = this.cacheOutlineNodes.get(symbol.id);
            if (symbol.children?.length) {
              return new OutlineCompositeTreeNode(
                this,
                parent,
                symbol,
                getSymbolIcon(symbol.kind) + ' outline-icon',
                cache?.id,
              );
            }
            return new OutlineTreeNode(this, parent, symbol, getSymbolIcon(symbol.kind) + ' outline-icon', cache?.id);
          }) || [];
      } else if (parent.raw) {
        children =
          parent.raw.children
            ?.map((symbol: INormalizedDocumentSymbol) => {
              const cache = this.cacheOutlineNodes.get(symbol.id);
              if (symbol.children?.length) {
                return new OutlineCompositeTreeNode(
                  this,
                  parent,
                  symbol,
                  getSymbolIcon(symbol.kind) + ' outline-icon',
                  cache?.id,
                );
              }
              return new OutlineTreeNode(this, parent, symbol, getSymbolIcon(symbol.kind) + ' outline-icon', cache?.id);
            })
            .filter((node) => !!node.name) || [];
      }
    }
    this.cacheNodes(children);
    return children;
  }

  private cacheNodes(nodes: (OutlineCompositeTreeNode | OutlineTreeNode | OutlineRoot)[]) {
    for (const node of nodes) {
      if ((node as OutlineTreeNode).raw) {
        // OutlineTreeNode or OutlineCompositeTreeNode
        this.cacheOutlineNodes.set((node as OutlineTreeNode).raw.id, node as OutlineTreeNode);
      }
    }
  }

  getTreeNodeBySymbol(symbol: INormalizedDocumentSymbol) {
    if (symbol) {
      const cache = this.cacheOutlineNodes.get(symbol.id);
      return cache;
    }
  }

  sortComparator = (a: ITreeNodeOrCompositeTreeNode, b: ITreeNodeOrCompositeTreeNode) => {
    if (this.sortType === OutlineSortOrder.ByKind) {
      return (
        (a as OutlineTreeNode).raw.kind - (b as OutlineTreeNode).raw.kind ||
        this.collator.getValue().compare(a.name, b.name)
      );
    } else if (this.sortType === OutlineSortOrder.ByName) {
      return (
        this.collator.getValue().compare(a.name, b.name) ||
        compareRangesUsingStarts((a as OutlineTreeNode).raw.range, (b as OutlineTreeNode).raw.range)
      );
    } else {
      return (
        compareRangesUsingStarts((a as OutlineTreeNode).raw.range, (b as OutlineTreeNode).raw.range) ||
        this.collator.getValue().compare(a.name, b.name)
      );
    }
  };
}
