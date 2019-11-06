import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent, TreeNode, CompositeTreeNode, URI } from '@ali/ide-core-browser';
import { DocumentSymbolChangedEvent, DocumentSymbolStore, DocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { observable, action } from 'mobx';
import { getSymbolIcon } from '@ali/ide-core-browser/lib/icon';

export interface NodeStatus {
  selected?: boolean;
  expanded?: boolean;
}

@Injectable()
export class OutLineService extends WithEventBus {
  @Autowired()
  documentSymbolStore: DocumentSymbolStore;

  @observable.ref treeNodes: TreeSymbol[] = [];

  // 状态存储
  private statusMap: Map<string, NodeStatus> = new Map();

  private currentSymbols: DocumentSymbol[] = [];
  private currentUri: URI;
  private currentSelectedId: string;

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    const symbols = this.documentSymbolStore.getDocumentSymbol(e.payload);
    if (symbols) {
      this.currentSymbols = symbols;
      this.currentUri = e.payload;
      const nodes: TreeSymbol[] = [];
      createTreeNodesFromSymbolTreeDeep({ children: symbols } as TreeSymbol, -1, nodes, this.statusMap, e.payload.toString());
      this.treeNodes = nodes.map((node) => {
        const symbolId = e.payload + node.name;
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
    }
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
  onSelect(nodes: TreeSymbol) {
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
      icon: getSymbolIcon(symbol.kind),
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
