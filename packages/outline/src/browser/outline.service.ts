import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent, TreeNode, CompositeTreeNode, URI } from '@ali/ide-core-browser';
import { DocumentSymbolChangedEvent, DocumentSymbolStore, DocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { observable, action } from 'mobx';
import { getSymbolIcon } from '@ali/ide-core-browser/lib/icon';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { EditorSelectionChangeEvent } from '@ali/ide-editor/lib/browser';
import debounce = require('lodash.debounce');

export interface NodeStatus {
  selected?: boolean;
  expanded?: boolean;
}

@Injectable()
export class OutLineService extends WithEventBus {
  @Autowired()
  documentSymbolStore: DocumentSymbolStore;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @observable.ref treeNodes: TreeSymbol[] = [];

  // 状态存储
  private statusMap: Map<string, NodeStatus> = new Map();

  private currentSymbols: DocumentSymbol[] = [];
  private currentUri: URI;
  private currentSelectedId: string;

  // 处理事件去重 + debounce
  private debouncedChangeEvent: Map<string, () => any> = new Map();

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    this.doUpdate(e.payload.editorUri);
  }

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    this.doUpdate(e.payload);
  }

  @action.bound
  handleTwistieClick(node: TreeSymbol) {
    const status = this.statusMap.get(node.id)!;
    status.expanded = !status.expanded;
    const nodes: TreeSymbol[] = [];
    createTreeNodesFromSymbolTreeDeep({ children: this.currentSymbols } as TreeSymbol, -1, nodes, this.statusMap, this.currentUri.toString());
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
      }, 100, {maxWait: 1000}));
    }
    this.debouncedChangeEvent.get(uri.toString())!();
  }

  protected doUpdate(uri: URI) {
    const symbols = this.documentSymbolStore.getDocumentSymbol(uri);
    this.currentSymbols = symbols || [];
    this.currentUri = uri;
    if (symbols) {
      const nodes: TreeSymbol[] = [];
      createTreeNodesFromSymbolTreeDeep({ children: symbols } as TreeSymbol, -1, nodes, this.statusMap, uri.toString());
      this.treeNodes = nodes.map((node) => {
        const symbolId = uri + node.name;
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
        return {
          ...node,
          ...status,
        };
      });
    } else {
      this.treeNodes = [];
    }
  }

  protected revealRange(symbol: TreeSymbol) {
    const currentEditor = this.editorService.currentEditorGroup.codeEditor;
    currentEditor.setSelection(symbol.selectionRange);
    currentEditor.monacoEditor.revealRangeInCenter(symbol.range);
  }
}

// 将 SymbolTree 打平成 TreeNodeList
function createTreeNodesFromSymbolTreeDeep(parent: TreeSymbol, depth: number, treeNodes: TreeSymbol[], statusMap: Map<string, NodeStatus>, uri: string) {
  parent.children!.forEach((symbol) => {
    const symbolId = uri + symbol.name;
    let status = statusMap.get(symbolId);
    if (!status) {
      status = {
        selected: false,
      };
      if (symbol.children && symbol.children.length > 0) {
        status.expanded = true;
      }
      statusMap.set(symbolId, status);
    }
    const treeSymbol: TreeSymbol = {
      ...symbol,
      depth: depth + 1,
      parent,
      id: symbolId,
      icon: getSymbolIcon(symbol.kind) + ' outline-icon',
      ...status,
    };
    treeNodes.push(treeSymbol);
    if (symbol.children && symbol.children.length > 0 && status.expanded) {
      createTreeNodesFromSymbolTreeDeep(treeSymbol, depth + 1, treeNodes, statusMap, uri);
    }
  });
}

interface TreeSymbol extends DocumentSymbol {
  id: string;
  depth: number;
  parent: TreeSymbol;
  icon: string;
  selected?: boolean;
  expanded?: boolean;
}
