import { Injectable, Autowired } from '@ali/common-di';
import { WithEventBus, OnEvent, TreeNode, CompositeTreeNode } from '@ali/ide-core-browser';
import { DocumentSymbolChangedEvent, DocumentSymbolStore, DocumentSymbol } from '@ali/ide-editor/lib/browser/breadcrumb/document-symbol';
import { observable } from 'mobx';
import { getSymbolIcon } from '@ali/ide-core-browser/lib/icon';

export interface NodeStatus {
  selected?: boolean;
  expanded?: boolean;
}

// TODO 点击事件，展开状态，父子关系
@Injectable()
export class OutLineService extends WithEventBus {
  @Autowired()
  documentSymbolStore: DocumentSymbolStore;

  @observable.ref treeNodes: TreeSymbol[] = [];

  // 状态存储
  private statusMap: Map<string, NodeStatus> = new Map();

  @OnEvent(DocumentSymbolChangedEvent)
  onDocumentSymbolChange(e: DocumentSymbolChangedEvent) {
    const symbols = this.documentSymbolStore.getDocumentSymbol(e.payload);
    if (symbols) {
      const nodes: TreeSymbol[] = [];
      createTreeNodesFromSymbolTreeDeep({ children: symbols } as TreeSymbol, -1, nodes);
      this.treeNodes = nodes.map((node) => {
        const symbolId = e.payload + node.name;
        let status = this.statusMap.get(symbolId);
        if (!status) {
          status = {
            selected: false,
            expanded: node.children && node.children.length > 0 ? true : undefined,
          };
          this.statusMap.set(symbolId, status);
        }
        return {
          ...node,
          ...status,
        };
      });
    }
  }

  handleTwistieClick(node: TreeSymbol) {
    console.log(node);
  }

  onSelect(node: TreeSymbol) {
    console.log(node);
  }
}

// 将 SymbolTree 打平成 TreeNodeList
function createTreeNodesFromSymbolTreeDeep(parent: TreeSymbol, depth: number, treeNodes: TreeSymbol[]) {
  parent.children!.forEach((symbol) => {
    const treeSymbol: TreeSymbol = {
      ...symbol,
      depth: depth + 1,
      parent,
      id: symbol.name,
      icon: getSymbolIcon(symbol.kind),
    };
    treeNodes.push(treeSymbol);
    if (symbol.children && symbol.children.length > 0) {
      createTreeNodesFromSymbolTreeDeep(treeSymbol, depth + 1, treeNodes);
    }
  });
}

interface TreeSymbol extends DocumentSymbol {
  id: string;
  depth: number;
  parent: TreeSymbol;
  icon: string;
}
