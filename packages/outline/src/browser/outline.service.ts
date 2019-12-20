import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent, TreeNode, CompositeTreeNode, URI, MaybeNull, IPosition, IdleValue, compareRangesUsingStarts, IContextKeyService } from '@ali/ide-core-browser';
import { DocumentSymbolChangedEvent, DocumentSymbolStore, DocumentSymbol, INormalizedDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { observable, action } from 'mobx';
import { getSymbolIcon } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { EditorSelectionChangeEvent } from '@ali/ide-editor/lib/browser';
import debounce = require('lodash.debounce');
import { findCurrentDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/default';

export interface NodeStatus {
  selected?: boolean;
  expanded?: boolean;
}

export const enum OutlineSortOrder {
  ByPosition,
  ByName,
  ByKind,
}

@Injectable()
export class OutLineService extends WithEventBus {
  // TODO @魁武 tree需要支持定位激活元素到视区能力
  public followCursor: boolean = false;

  get sortType() {
    return this._sortType;
  }

  set sortType(type: OutlineSortOrder) {
    this.doUpdate(this.currentUri);
    this.ctxKeyService.createKey('outlineSortType', type);
    this._sortType = type;
  }

  private _sortType: OutlineSortOrder = OutlineSortOrder.ByPosition;

  @Autowired()
  private documentSymbolStore: DocumentSymbolStore;

  @Autowired(WorkbenchEditorService)
  private editorService: WorkbenchEditorService;

  @Autowired(IContextKeyService)
  private ctxKeyService: IContextKeyService;

  @observable.ref treeNodes: TreeSymbol[] = [];

  // 状态存储
  private statusMap: Map<string, NodeStatus> = new Map();

  private currentSymbols: DocumentSymbol[] = [];
  private currentUri: MaybeNull<URI>;
  private currentSelectedId: string;

  // 处理事件去重 + debounce
  private debouncedChangeEvent: Map<string, () => any> = new Map();

  // 处理字符串排序，IdleValue 在空闲或需要时执行 [idle-or-urgent stratage implementation](https://philipwalton.com/articles/idle-until-urgent)
  private readonly collator = new IdleValue<Intl.Collator>(() => new Intl.Collator(undefined, { numeric: true }));

  constructor() {
    super();
    this.editorService.onActiveResourceChange((e) => {
      if (e && e.uri && e.uri.scheme === 'file') {
        this.notifyUpdate(e.uri);
      } else {
        this.doUpdate(null);
      }
    });
    // TODO 状态记录
    this.ctxKeyService.createKey('outlineSortType', OutlineSortOrder.ByPosition);
  }

  collapseAll() {
    this.treeNodes.forEach((symbol) => {
      // tree组件使用for in判断的，有点僵硬
      const status = this.getOrCreateStatus(this.currentUri, symbol);
      if (status.expanded) {
        status.expanded = false;
      }
    });
    this.doUpdate(this.currentUri, true);
  }

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    this.notifyUpdate(e.payload.editorUri);
  }

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    this.notifyUpdate(e.payload);
  }

  @action.bound
  handleTwistieClick(node: TreeSymbol) {
    const status = this.statusMap.get(node.id)!;
    status.expanded = !status.expanded;
    const nodes: TreeSymbol[] = [];
    createTreeNodesFromSymbolTreeDeep({ children: this.currentSymbols } as TreeSymbol, -1, nodes, this.statusMap, this.currentUri!);
    this.treeNodes = nodes;
  }

  // 树重新生成逻辑会比较好维护，但是性能会差一些
  @action.bound
  onSelect(nodes: TreeSymbol[]) {
    this.revealRange(nodes[0]);
    const prevNode = this.treeNodes.find((item) => item.id === this.currentSelectedId)!;
    if (prevNode) {
      prevNode.selected = false;
      this.statusMap.get(this.currentSelectedId)!.selected = false;
    }
    this.treeNodes.find((item) => item.id === nodes[0].id)!.selected = true;
    this.statusMap.get(nodes[0].id)!.selected = true;
    this.currentSelectedId = nodes[0].id;
    // 改变引用
    this.treeNodes = this.treeNodes.slice();
  }

  protected notifyUpdate(uri: URI) {
    if (!this.debouncedChangeEvent.has(uri.toString())) {
      this.debouncedChangeEvent.set(uri.toString(), debounce(() => {
        this.doUpdate(uri);
      }, 100, { maxWait: 1000 }));
    }
    this.debouncedChangeEvent.get(uri.toString())!();
  }

  protected getOrCreateStatus(uri: MaybeNull<URI>, node: INormalizedDocumentSymbol): NodeStatus {
    const symbolId = node.id;
    let status = this.statusMap.get(symbolId);
    if (!status) {
      status = {
        selected: false,
      };
      if (node.children && node.children.length > 0) {
        status.expanded = true;
      }
      this.statusMap.set(symbolId, status);
    }
    return status;
  }

  protected doUpdate(uri: MaybeNull<URI>, ignoreCursor?: boolean) {
    const symbols = uri && this.documentSymbolStore.getDocumentSymbol(uri);
    this.currentSymbols = symbols || [];
    this.sortSymbolTree(this.currentSymbols);
    this.currentUri = uri;
    if (symbols) {
      if (!ignoreCursor && this.followCursor) {
        this.selectCursorSymbol(uri!, symbols);
      }
      const nodes: TreeSymbol[] = [];
      createTreeNodesFromSymbolTreeDeep({ children: symbols } as TreeSymbol, -1, nodes, this.statusMap, uri!);
      this.treeNodes = nodes.map((node) => {
        const status = this.getOrCreateStatus(uri, node);
        return {
          ...node,
          ...status,
        };
      });
    } else {
      this.treeNodes = [];
    }
  }

  protected sortSymbolTree(symbols: DocumentSymbol[]) {
    this.doSort(symbols);
    symbols.forEach((symbol) => {
      if (symbol.children) {
        this.sortSymbolTree(symbol.children);
      }
    });
  }

  protected doSort(symbols: DocumentSymbol[]) {
    symbols.sort((a, b) => {
      if (this.sortType === OutlineSortOrder.ByKind) {
        return a.kind - b.kind || this.collator.getValue().compare(a.name, b.name);
      } else if (this.sortType === OutlineSortOrder.ByName) {
        return this.collator.getValue().compare(a.name, b.name) || compareRangesUsingStarts(a.range, b.range);
      } else {
        return compareRangesUsingStarts(a.range, b.range) || this.collator.getValue().compare(a.name, b.name);
      }
    });
  }

  protected selectCursorSymbol(uri: URI, symbols: INormalizedDocumentSymbol[]) {
    const activeSymbols = findCurrentDocumentSymbol(symbols, this.editorService.currentEditorGroup.codeEditor.monacoEditor.getPosition());
    // 清除上次选中状态
    if (this.statusMap.get(this.currentSelectedId)) {
      this.statusMap.get(this.currentSelectedId)!.selected = false;
    }
    activeSymbols.forEach((symbol, index) => {
      const status = this.getOrCreateStatus(uri, symbol);
      // 非当前position的叶子节点
      if (index < activeSymbols.length - 1) {
        status.expanded = true;
      } else {
        this.currentSelectedId = symbol.id;
        status.selected = true;
      }
    });
  }

  protected revealRange(symbol: TreeSymbol) {
    const currentEditor = this.editorService.currentEditorGroup.codeEditor;
    currentEditor.monacoEditor.revealLineInCenter(symbol.range.startLineNumber);
    currentEditor.monacoEditor.setPosition(new monaco.Position(symbol.range.startLineNumber, 0));
  }

}

// 将 SymbolTree 打平成 TreeNodeList
function createTreeNodesFromSymbolTreeDeep(parent: TreeSymbol, depth: number, treeNodes: TreeSymbol[], statusMap: Map<string, NodeStatus>, uri: URI) {
  parent.children!.forEach((symbol) => {
    let status = statusMap.get(symbol.id);
    if (!status) {
      status = {
        selected: false,
      };
      if (symbol.children && symbol.children.length > 0) {
        status.expanded = true;
      }
      statusMap.set(symbol.id, status);
    }
    const treeSymbol: TreeSymbol = {
      ...symbol,
      depth: depth + 1,
      parent,
      icon: getSymbolIcon(symbol.kind) + ' outline-icon',
      ...status,
    };
    treeNodes.push(treeSymbol);
    if (symbol.children && symbol.children.length > 0 && status.expanded) {
      createTreeNodesFromSymbolTreeDeep(treeSymbol, depth + 1, treeNodes, statusMap, uri);
    }
  });
}

interface TreeSymbol extends INormalizedDocumentSymbol {
  depth: number;
  parent: TreeSymbol;
  children: TreeSymbol[];
  icon: string;
  selected?: boolean;
  expanded?: boolean;
}
