import * as React from 'react';
import { URI } from '@ali/ide-core-common';
import { ConfigContext } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeNodeHighlightRange } from '@ali/ide-core-browser/lib/components';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExplorerService } from '@ali/ide-explorer/lib/browser/explorer.service';
import { IDocumentModelManager } from '@ali/ide-doc-model/lib/common';
import { replaceAll } from './replace';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  children?: ISearchTreeItem[];
  badge?: number;
  highLightRange?: TreeNodeHighlightRange;
  [key: string]: any;
}

export interface ISearchLayoutProp {
  width: number;
  height: number;
  [key: string]: any;
}

export interface ISearchTreeProp {
  searchPanelLayout: {
    width: number;
    height: number;
  };
  searchResults: Map<string, ContentSearchResult[]> | null;
  searchValue: string;
  searchState: SEARCH_STATE;
  replaceInputRef: React.RefObject<HTMLInputElement | null>;
}

const itemLineHeight = 22;

function onSelect(
  files: ISearchTreeItem[],
  workbenchEditorService,
  nodes: ISearchTreeItem[],
  setNodes,
) {
  const file: ISearchTreeItem = files[0];

  if (!file) {
    return;
  }

  if (!file.parent) {
    // Click file name
    const newNodes = nodes.map((node) => {
      if (node.id === file!.id) {
        node.expanded = !node.expanded;
      }
      return node;
    });
    return setNodes(newNodes);
  }

  // Click file result line
  const result: ContentSearchResult = file.searchResult;
  return workbenchEditorService.open(
    new URI(result.fileUri),
    {
      disableNavigate: true,
      range: {
        startLineNumber: result.line,
        startColumn: result.matchStart,
        endLineNumber: result.line,
        endColumn: result.matchStart + result.matchLength,
      },
    },
  );
}

function commandActuator(
  commandId: string,
  id: string,
  items: ISearchTreeItem[],
  setNodes: (items: ISearchTreeItem[]) => void,
  documentModelManager: IDocumentModelManager,
  replaceText: string,
) {
  const methods = {
    closeResult() {
      let newItems = items.map((item) => {
        if (id === item.id) {
          item.willDelete = true;
        }
        return item;
      });
      newItems = newItems.filter((item) => {
        if (item.children) {
          item.children = item.children.filter((child) => {
            return !child.willDelete;
          });
          if (item.children.length < 1) {
            return false;
          }
          item.badge = item.children.length;
          return true;
        }
        if (item.parent && item.willDelete) {
          return false;
        }
        return true;
      });
      setNodes(newItems);
    },
    replaceResult() {
      let select: ISearchTreeItem | null = null;
      items.some((item) => {
        if (id === item.id) {
          select = item;
          return true;
        }
      });
      if (!select) {
        return;
      }
      const resultMap: Map<string, ContentSearchResult[]> = new Map();
      resultMap.set(select!.parent!.fileUri, [select!.searchResult]);
      replaceAll(
        documentModelManager,
        resultMap,
        replaceText,
      ).then(() => {
        methods.closeResult();
      });
    },
    closeResults() {
      const newItems = items.filter((item) => {
        if (id === item.id) {
          return false;
        }
        if (item.parent && item.parent.id === id) {
          return false;
        }
        return true;
      });
      setNodes(newItems);
    },
    replaceResults() {
      let select: ISearchTreeItem | null = null;
      items.some((item) => {
        if (id === item.id) {
          select = item;
          return true;
        }
      });
      if (!select) {
        return;
      }
      const resultMap: Map<string, ContentSearchResult[]> = new Map();
      const contentSearchResult: ContentSearchResult[] = select!.children!.map((child) => {
        return child.searchResult;
      });
      resultMap.set(select!.fileUri, contentSearchResult);
      replaceAll(
        documentModelManager,
        resultMap,
        replaceText,
      ).then(() => {
        methods.closeResults();
      });
    },
  };

  if (!methods[commandId]) {
    return;
  }
  return methods[commandId]();
}

function getRenderTree(nodes: ISearchTreeItem[]) {
  return nodes.filter((node) => {
    if (node && node.parent) {
      if (node.parent.expanded === false) {
        return false;
      }
    }
    return true;
  });
}

function getChildrenNodes(resultList: ContentSearchResult[], uri: URI, replaceValue: string, parent?): ISearchTreeItem[] {
  const result: ISearchTreeItem[] = [];
  resultList.forEach((searchResult: ContentSearchResult, index: number) => {
    result.push({
      id: `${uri.toString()}?index=${index}`,
      name: searchResult.lineText,
      highLightRange: {
        start: searchResult.matchStart,
        end: searchResult.matchStart + searchResult.matchLength,
      },
      order: index,
      depth: 1,
      searchResult,
      parent,
      uri,
    });
  });

  return result;
}

function getParentNodes( searchResults: Map<string, ContentSearchResult[]> | null, replaceValue: string): ISearchTreeItem[] {
  const result: ISearchTreeItem[] = [];
  let order = 0;

  if (!searchResults) {
    return result;
  }

  searchResults.forEach((resultList: ContentSearchResult[], uri: string) => {
    const _uri = new URI(uri);
    const description = _uri.codeUri.path.replace(`${resultList[0] && resultList[0].root || ''}/`, '');
    const node: ISearchTreeItem  = {
      description,
      expanded: true,
      id: uri,
      uri: _uri,
      name: _uri.displayName,
      order: order++,
      depth: 0,
      parent: undefined,
    };
    node.children = getChildrenNodes(resultList, _uri, replaceValue, node);
    node.badge = node.children.length;
    if (node.children.length > 10) {
      // 结果太多大于10 则默认折叠
      node.expanded = false;
    }
    result.push(node);
    node.children.forEach((child) => {
      result.push(child);
    });
  });

  return result;
}

function getScrollContainerStyle(explorerService: ExplorerService, searchPanelLayout: any): ISearchLayoutProp {
  return {
    width: explorerService.layout.width || 0,
    height: explorerService.layout.height - searchPanelLayout.height - 30 || 0,
  } as ISearchLayoutProp;
}

export const SearchTree = React.forwardRef((
  {
    searchResults,
    searchPanelLayout,
    replaceInputRef,
  }: ISearchTreeProp,
  ref,
) => {
  const configContext = React.useContext(ConfigContext);
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState<ISearchLayoutProp>({
    width: 0,
    height: 0,
  });
  const { injector } = configContext;
  // TODO: 两个DI注入实际上可以移动到模块顶层统一管理，通过props传入
  const workbenchEditorService = injector.get(WorkbenchEditorService);
  const explorerService = injector.get(ExplorerService);
  const documentModelManager = injector.get(IDocumentModelManager);
  const [nodes, setNodes] = React.useState<ISearchTreeItem[]>([]);

  React.useEffect(() => {
    setScrollContainerStyle(getScrollContainerStyle(explorerService, searchPanelLayout));
  }, [searchPanelLayout]);

  React.useEffect(() => {
    setNodes(getParentNodes(searchResults, replaceInputRef.current && replaceInputRef.current.value || ''));
  }, [searchResults && searchResults.size]);

  React.useImperativeHandle(ref, () => ({
    foldTree() {
      const newNodes = nodes.map((node) => {
        node.expanded = false;
        return node;
      });
      setNodes(newNodes);
    },
  }));

  return (
    <div className={styles.tree}>
      {searchResults && searchResults.size > 0 ?
        <RecycleTree
          replace={ replaceInputRef.current && replaceInputRef.current.value || '' }
          onSelect = { (files) => { onSelect(files, workbenchEditorService, nodes, setNodes); } }
          nodes = { getRenderTree(nodes) }
          scrollContainerStyle = { scrollContainerStyle }
          contentNumber = { nodes.length }
          itemLineHeight = { itemLineHeight }
          commandActuator= { (cmdId, id) => { commandActuator(cmdId, id, nodes, setNodes, documentModelManager, replaceInputRef.current && replaceInputRef.current.value || ''); return {}; } }
          actions= {[{
            icon: 'volans_icon close',
            title: 'closeFile',
            command: 'closeResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon swap',
            title: 'replaceFile',
            command: 'replaceResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon close',
            title: 'closeFolder',
            command: 'closeResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon swap',
            title: 'replaceFolder',
            command: 'replaceResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          }]}
        / > :    ''
      }
    </div>
  );
});
