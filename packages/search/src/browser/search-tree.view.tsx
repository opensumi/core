import * as React from 'react';
import { URI } from '@ali/ide-core-common';
import { ConfigContext } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { FileStat } from '@ali/ide-file-service/lib/common/';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExplorerService } from '@ali/ide-explorer/lib/browser/explorer.service';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  filestat: FileStat;
  children?: ISearchTreeItem[] | any;
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
      range: {
        startLineNumber: result.line,
        startColumn: result.matchStart,
        endLineNumber: result.line,
        endColumn: result.matchStart + result.matchLength,
      },
    },
  );
}

function getRenderTree(nodes: ISearchTreeItem[]) {
  return nodes.filter((node) => {
    if (node && node.parent && !node.parent.expanded) {
      return false;
    }
    return true;
  });
}

function getChildren(resultList: ContentSearchResult[], uri: URI, parent?): ISearchTreeItem[] {
  const result: ISearchTreeItem[] = [];

  resultList.forEach((searchResult: ContentSearchResult, index: number) => {
    result.push({
      filestat: {} as FileStat,
      id: uri.toString() + index,
      name: searchResult.lineText,
      // description: searchResult.lineText,
      order: index,
      depth: 1,
      searchResult,
      parent,
      uri,
    });
  });

  return result;
}

function getNodes( searchResults: Map<string, ContentSearchResult[]> | null): ISearchTreeItem[] {
  const result: ISearchTreeItem[] = [];
  let order = 0;

  if (!searchResults) {
    return result;
  }

  searchResults.forEach((resultList: ContentSearchResult[], uri: string) => {
    const _uri = new URI(uri);
    const node: ISearchTreeItem  = {
      filestat: {} as FileStat,
      expanded: true,
      id: uri,
      uri: _uri,
      name: _uri.displayName,
      order: order++,
      depth: 0,
      parent: undefined,
    };
    node.children = getChildren(resultList, _uri, node);
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
    height: explorerService.layout.height - searchPanelLayout.height - 20 || 0,
  } as ISearchLayoutProp;
}

export const SearchTree = React.forwardRef((
  {
    searchResults,
    searchPanelLayout,
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
  const [nodes, setNodes] = React.useState<ISearchTreeItem[]>([]);

  React.useEffect(() => {
    setScrollContainerStyle(getScrollContainerStyle(explorerService, searchPanelLayout));
  }, [searchPanelLayout]);

  React.useEffect(() => {
    setNodes(getNodes(searchResults));
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
          onSelect = { (files) => { onSelect(files, workbenchEditorService, nodes, setNodes); } }
          nodes = { getRenderTree(nodes) }
          scrollContainerStyle = { scrollContainerStyle }
          contentNumber = { nodes.length }
          itemLineHeight = { itemLineHeight }
        /> : ''
      }
    </div>
  );
});
