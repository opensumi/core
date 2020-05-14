import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent, URI, MaybeNull, IdleValue, compareRangesUsingStarts, IContextKeyService, IStorage, MarkerManager, MarkerSeverity, IRange } from '@ali/ide-core-browser';
import { DocumentSymbolChangedEvent, DocumentSymbolStore, DocumentSymbol, INormalizedDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { observable, action } from 'mobx';
import { getSymbolIcon } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { EditorSelectionChangeEvent } from '@ali/ide-editor/lib/browser';
import debounce = require('lodash.debounce');
import { findCurrentDocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/default';
import { binarySearch, coalesceInPlace } from '@ali/ide-core-common/lib/arrays';
import { listErrorForeground, listWarningForeground, IThemeService } from '@ali/ide-theme';

export interface NodeStatus {
  selected?: boolean;
  expanded?: boolean;
  badge?: string;
  color?: string;
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
    this._sortType = type;
    this.doUpdate(this.currentUri);
    this.ctxKeyService.createKey('outlineSortType', type);
    this.state.set('sortType', type);
  }

  private _sortType: OutlineSortOrder = OutlineSortOrder.ByPosition;

  @Autowired()
  private documentSymbolStore: DocumentSymbolStore;

  @Autowired(WorkbenchEditorService)
  private editorService: WorkbenchEditorService;

  @Autowired(IContextKeyService)
  private ctxKeyService: IContextKeyService;

  @Autowired()
  private markerManager: MarkerManager;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  @observable.ref treeNodes: TreeSymbol[] = [];

  // 状态存储
  private statusMap: Map<string, NodeStatus> = new Map();

  private currentUri: MaybeNull<URI>;
  private currentSelectedId: string;

  // 处理事件去重 + debounce
  private debouncedChangeEvent: Map<string, () => any> = new Map();

  // 处理字符串排序，IdleValue 在空闲或需要时执行 [idle-or-urgent stratage implementation](https://philipwalton.com/articles/idle-until-urgent)
  private readonly collator = new IdleValue<Intl.Collator>(() => new Intl.Collator(undefined, { numeric: true }));

  private state: IStorage;

  constructor() {
    super();
    this.editorService.onActiveResourceChange((e) => {
      // 避免内存泄漏
      this.statusMap.clear();
      if (e && e.uri && e.uri.scheme === 'file') {
        this.notifyUpdate(e.uri);
      } else {
        this.doUpdate(null);
      }
    });
    this.ctxKeyService.createKey('outlineSortType', OutlineSortOrder.ByPosition);
    this.markerManager.onMarkerChanged((resources) => {
      if (this.currentUri && resources.find((resource) => resource === this.currentUri!.toString())) {
        this.doUpdate(this.currentUri, undefined, true);
      }
    });
  }

  initializeSetting(state: IStorage) {
    this.state = state;
    this.sortType = state.get('sortType', OutlineSortOrder.ByPosition);
  }

  collapseAll() {
    this.treeNodes.forEach((symbol) => {
      // tree组件使用for in判断的，有点僵硬
      const status = this.getOrCreateStatus(symbol);
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
    this.notifyUpdate(this.currentUri!);
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

  protected getOrCreateStatus(node: INormalizedDocumentSymbol): NodeStatus {
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

  protected doUpdate(uri: MaybeNull<URI>, ignoreCursor?: boolean, updateMarker?: boolean) {
    const symbols = uri && this.documentSymbolStore.getDocumentSymbol(uri);
    const clonedSymbols = symbols && symbols.map((i) => i) || [];
    const diagnosisInfo: IOutlineMarker[] = uri ? this.markerManager.getMarkers({ resource: uri.toString(), opened: true }) : [];
    // 为了后续使用折半查找
    diagnosisInfo.sort(compareRangesUsingStarts);
    this.sortSymbolTree(clonedSymbols);
    this.currentUri = uri;
    if (clonedSymbols.length) {
      if (!ignoreCursor && this.followCursor) {
        this.selectCursorSymbol(uri!, clonedSymbols);
      }
      const nodes: TreeSymbol[] = [];
      createTreeNodesFromSymbolTreeDeep({ children: clonedSymbols } as TreeSymbol, -1, nodes, this.statusMap, uri!);
      if (updateMarker) {
        this.clearMarkers();
        nodes.forEach((item) => this.updateMarker(diagnosisInfo, item));
      }
      this.treeNodes = nodes.map((node) => {
        const status = this.getOrCreateStatus(node);
        return {
          ...node,
          ...status,
        };
      });
    } else {
      this.treeNodes = [];
    }
  }

  private clearMarkers() {
    this.statusMap.forEach((status) => {
      delete status.badge;
      delete status.color;
    });
  }

  private updateMarker(markers: IOutlineMarker[], item: TreeSymbol): void {
    // TODO 性能优化，视图折叠时service不响应
    // 使用折半查找获取到range.start与目标节点一致的marker信息
    const idx = binarySearch<IRange>(markers, item.range, monaco.Range.compareRangesUsingStarts);
    let start: number;
    if (idx < 0) {
      // tslint:disable-next-line: no-bitwise
      start = ~idx;
      if (start > 0 && monaco.Range.areIntersecting(markers[start - 1], item.range)) {
        start -= 1;
      }
    } else {
      start = idx;
    }

    const myMarkers: IOutlineMarker[] = [];
    let myTopSev: MarkerSeverity | undefined;

    for (; start < markers.length && monaco.Range.areIntersecting(item.range, markers[start]); start++) {
      // 将与目标节点range相交的marker信息存入内部数组myMarkers，用于子节点的计算
      // 在遍历相交marker信息的同时，获取问题严重性的最大值
      const marker = markers[start];
      myMarkers.push(marker);
      // 清空父节点与当前节点相关的marker信息条目
      (markers as Array<IOutlineMarker | undefined>)[start] = undefined;
      if (!myTopSev || marker.severity > myTopSev) {
        myTopSev = marker.severity;
      }
    }

    // 使用与当前节点相交的marker信息计算子节点信息
    // tslint:disable-next-line: forin
    for (const key in item.children) {
      this.updateMarker(myMarkers, item.children[key]);
    }

    if (myTopSev) {
      const status = this.getOrCreateStatus(item);
      // 若当前节点存在问题，且均属于子节点的问题，则渲染一个·符号
      // TODO @魁武 vscode渲染的是一个圆形的icon，tree能否支持？
      status.badge = myMarkers.length > 0 ? (myMarkers.length > 9 ? '9+' : myMarkers.length + '') : '•';
      status.color = this.themeService.getColor({ id: myTopSev === MarkerSeverity.Error ? listErrorForeground : listWarningForeground });
    }
    // 清空非真的数组元素
    coalesceInPlace(markers);
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
      const status = this.getOrCreateStatus(symbol);
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
    if (status.expanded === undefined && symbol.children && symbol.children.length > 0) {
      // 叶子节点下新增了新的子节点
      status.expanded = true;
    } else if (!symbol.children || symbol.children.length === 0) {
      // 节点下子节点全部被删除
      delete status.expanded;
    }
    const treeSymbol: TreeSymbol = {
      ...symbol,
      depth: depth + 1,
      parent,
      icon: getSymbolIcon(symbol.kind) + ' outline-icon',
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
  color?: string;
  badge?: number | string;
}

export interface IOutlineMarker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: MarkerSeverity;
}
